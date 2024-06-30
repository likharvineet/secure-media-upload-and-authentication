import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refereshToken = user.generateRefreshToken();
    user.refereshToken = refereshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refereshToken };
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
  if (!username || !email) {
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
  const { accessToken, refereshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // NOTE: hame user ko password and refreshToken nahi bhejna
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // TODO: send token and data to cookie securely
});
export { registerUser, loginUser };
