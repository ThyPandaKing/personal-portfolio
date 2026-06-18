import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

export const USER_ROLES = ["admin", "visitor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    picture: { type: String, default: "" },
    role: { type: String, enum: USER_ROLES, default: "visitor", index: true },
    // Visitor-editable profile fields. Admins edit the singleton Home Profile instead.
    headline: { type: String, default: "" },
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema> & { _id: string };
export const UserModel = model("User", userSchema, COLLECTIONS.users);
