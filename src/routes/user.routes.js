import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// http://localhost:8000/api/v1/users/register
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// Secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken); //NOTE: qki humne jwt controller me hi very kar liya hai isliye hume verifyJWT middleware call karne ki zaroorat nahi hai
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").post(verifyJWT, updateAccountDetails);
// NOTE: humne patch isliye use kiya qki hum sirf ek hi field update kar rahe hai
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
// NOTE: humne patch isliye use kiya qki hum sirf ek hi field update kar rahe hai
router
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);
// IMP: qki hum username req.params se le rahe hai joh url se milta hai isliye humne /c/:username likhar. Abhi joh bhi :username ki jagah likha hoga voh mujher {username} = req.params me milega. destrucutring me humne username likha hai isliye /c/:username likha hai
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
router.route("/history").get(verifyJWT, getWatchHistory);
export default router;
