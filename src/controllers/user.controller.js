import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler(async (req, res) => {
  // Steps:
  // get user details from frontend
  // validation - not empty
  // check if user already exists: using username, email
  // check for images, check if avatar is passed
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field form response
  // check for user creation
  // return res
});

export { registerUser };
