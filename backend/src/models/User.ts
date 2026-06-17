import { Schema, model, type InferSchemaType } from "mongoose";
import { COLLECTIONS } from "../config/collections.js";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    picture: { type: String, default: "" },
    role: { type: String, enum: ["admin"], default: "admin" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema> & { _id: string };
export const UserModel = model("User", userSchema, COLLECTIONS.users);
