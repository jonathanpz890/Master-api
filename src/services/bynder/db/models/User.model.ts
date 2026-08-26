import mongoose, { Schema, Document } from 'mongoose-bynder';

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  googleId?: string;
  subscriptionBudget?: number;
  mobileToken?: string;
  mobileTokenExpires?: Date;
  apiToken?: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: Date;
  settings?: {
    general: {
      theme: string;
      mode: 'dark' | 'light';
      gradients: boolean;
      gradientIntensity: number;
      colorIntensity: number;
      units: 'metric' | 'imperial';
      weekStart: number;
      sidebarDensity: string;
    };
    lists: {
      defaultView: string;
      autoCategorize: boolean;
      doneCollapseDelay: number;
    };
    recipes: {
      smartLinkIntensity: string;
      autoRoundUnits: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
    },
    profilePicture: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    accessToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    subscriptionBudget: {
      type: Number,
      default: 200,
    },
    lists: {
      type: [Schema.Types.ObjectId],
      ref: 'List',
    },
    mobileToken: {
      type: String,
    },
    mobileTokenExpires: {
      type: Date,
    },
    apiToken: {
      type: String,
    },
    settings: {
      general: {
        theme: { type: String, default: 'midnight' },
        mode: { type: String, enum: ['dark', 'light'], default: 'dark' },
        gradients: { type: Boolean, default: true },
        gradientIntensity: { type: Number, default: 50 },
        colorIntensity: { type: Number, default: 0 },
        units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
        weekStart: { type: Number, default: 1 },
        sidebarDensity: { type: String, default: 'comfortable' },
      },
      lists: {
        defaultView: { type: String, default: 'grid' },
        autoCategorize: { type: Boolean, default: true },
        doneCollapseDelay: { type: Number, default: 3 },
      },
      recipes: {
        smartLinkIntensity: { type: String, default: 'balanced' },
        autoRoundUnits: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ apiToken: 1 }, { sparse: true });

const User = mongoose.model<IUser>('User', UserSchema);

export default User;
