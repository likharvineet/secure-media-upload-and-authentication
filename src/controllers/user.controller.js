import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

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
  const existedUser = User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  // check for images, check if avatar is passed
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field form response
  // check for user creation
  // return res
});

export { registerUser };
