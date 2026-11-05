import mongoose from 'mongoose';

const supplyCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  isPredefined: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model('SupplyCategory', supplyCategorySchema);

