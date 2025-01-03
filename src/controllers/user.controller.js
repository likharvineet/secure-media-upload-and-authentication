import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while creating access and refresh token"
    );
  }
};

// qki hum iske andar db se communicate karege isliye hum async function use karege
const registerUser = asyncHandler(async (req, res) => {
  // Steps:
  // get user details from frontend
  const { fullName, email, username, password } = req.body;
  // validation - not empty
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  // check if user already exists: using username, email
  // if await nahi diya toh 409 error aayega
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  // check for images, check if avatar is passed
  // avatar and coverImage jaise humne route me name me define kiya hai same vaisa chahiye
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  // upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }
  // create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  // check for user creation
  // remove password and refresh token field form response
  // select me sab select hota hai toh -ve sign jispar laga hai voh chodkar baaki ke chize dega, matlab mujeh createdUser me password, and refresh token nahi milega
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // steps:
  // TODO: get req body -> data
  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }
  // TODO: check username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  // TODO: check password
  // hame isPasswordCorrect user(jisme humne User.findOne() save kiya hai) me milta hai na ki User me
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credential");
  }
  // TODO: generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // NOTE: hame user ko password and refreshToken nahi bhejna
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // TODO: send token and data to cookie securely
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          //NOTE: hum yaha isliye wapas access and refresh token bhej rahe hai agar user to frontend se isse set karna ho local storage me, jab user mobile app me kaam karta hai toh usse cookie ka access nahi hota toh aise case me hum ye karte hai
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // hame ise store karne ki jaroorat nahi
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    { new: true } // NOTE: if it is false then it will return old value which contains the refreshToken, and when it is true we get the new updated calue in which refreshToken is undefined
  );

  // TODO: clear cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }
  try {
    // NOTE: verify incomingFrefreshToken with Refresh token secret
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // TODO: get user data from refresh token id (qki hamne refresh token _id se generate ki hai toh main usme se _id decode kar sakta hu and us id se user find kar lunga)
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // TODO: check if the incomingRefreshToken belong to the same user
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expored or used");
    }

    // TODO: generate new tokens and send it to user
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refresh successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // NOTE: verifyJWT me hum req me user inject kar rahe hai, toh matlab mujhe req.user se loggin user ki details mil jaayegi
  const user = await User.findById(req.user?._id);

  // TODO: check if the old password match with the stored password, humne isPasswordCorrect() user me inject kiya hai
  // IMP: await isliye lagana padha qki isPasswordCorrect() method define karte time humne async use kiya tha
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  // TODO: generate new password
  // NOTE: humne user model me pre hook use kiya hai joh save hone par sun hota hai. and voh kahata hai ki agar passowrd modify ho raha hai tab main new password generate karunga
  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); // NOTE: save karne se pahale main baaki ke field ko validate nahi karna chahata
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // NOTE: qki hame verifyJWT se user mil raha hai toh hum ussi ko return kar dege
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName, // IMP: ES6 syntax
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // IMP: humne register me req.files liya hai qki hum middleware se multiple files (avatar, coverImage) le rahe the, but is case me hum sirf avatar hi le rahe hai
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avata: avatar.url, //IMP: hame avatar ka pura object mil raha hai
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // IMP: humne register me req.files liya hai qki hum middleware se multiple files (avatar, coverImage) le rahe the, but is case me hum sirf avatar hi le rahe hai
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url, //IMP: hame avatar ka pura object mil raha hai
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  // NOTE: koi bhi channel ka naam hume uske url me milta hai
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(), //IMP: hamne saare username lowercase rakhe hai
      },
    },
    {
      $lookup: {
        from: "subscriptions", // IMP: hame pata hai ki jab mongodb me save hota hai toh model lowercase me hota hai and plural form me hota hai
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },

    {
      $lookup: {
        from: "subscriptions", // IMP: hame pata hai ki jab mongodb me save hota hai toh model lowercase me hota hai and plural form me hota hai
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers", //NOTE: count documents
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo", //NOTE: count documents
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // NOTE: $in object and array dono me check karta hai. subscribers me subscribe field hai jisme hame hamara _id check karna hai
            then: true,
            else: false,
          },
        },
      },
    },
    // NOTE: yaha hum project ke liye likhege, project means mujhe kya kya chize return karni hai ya kya kya chize bhejni hai
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);
  // IMP: hame array return hota hai, hame pata hai ki [] ek truthy value hai toh isrf channel nahi but uski length dekhna hoga
  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exists");
  }

  // IMP: aggregation pipeline array return karta hai, qki humne sirf ek hi condition par matach kiya hai toh hame ek hi user milega, isliye hum channel[0] send karege
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        // NOTE: subpipeline, qki hame joh document milega usme hame owner nahi milega qki usme users._id hai
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",

              // IMP: hum yahi project use karege taaki owner me structure chota rahe, bahar lagate toh structure change hota
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          // NOTE: saara data hame owner me aaya hai jisko hum abhi datatype sudharte hai, hame pata hai ki owner[0] me meri details hogi , but mujhe owner[0] ki jagah mujhe owner se hi access karna hai taaki main dot notation de details le paau
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
