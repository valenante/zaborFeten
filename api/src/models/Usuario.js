// models/User.js
import { Schema, model } from 'mongoose';
import { hash, compare } from 'bcrypt';

const userSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Rol general (permite gatear pantallas/acciones)
    role: {
      type: String,
      enum: ['admin', 'camarero', 'cocinero', 'supervisor'],
      default: 'camarero',
    },

    // ⬅️ NUEVO: estación asignada para cocina
    estacion: {
      type: String,
      enum: ['frio', 'frito', 'plancha', null],
      default: null, // camarero/admin no necesitan estación
    },

    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.resetFailedAttempts = function () {
  this.failedAttempts = 0;
  return this.save();
};
userSchema.methods.incrementFailedAttempts = function () {
  this.failedAttempts += 1;
  return this.save();
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return compare(candidatePassword, this.password);
};

export default model('User', userSchema);
