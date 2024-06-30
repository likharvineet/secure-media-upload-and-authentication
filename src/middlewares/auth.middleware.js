import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

// NOTE: qki verifyJWT custom middleware hai, hame next pass karna hoga
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", ""); // NOTE: qki Authorization me hame Bearer <token> milta hai and hame sirf <token> ka kaam hai

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }
  const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  const user = await User.findById(decodedToken?._id).select(
    "-password -refreshToken"
  ); //NOTE: ye _id hamne jab access token generate method likha tha user.model.js me tab hamne jwt.sign me _id diya hai. toh hum wahi se voh id lene waale hai

  if (!user) {
    // TODO: discuss about frontend
    throw new ApiError(401, "Invalid Access Token");
  }
  req.user = user
  next()
});