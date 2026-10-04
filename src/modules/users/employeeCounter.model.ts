import mongoose, { Schema } from 'mongoose';

interface IEmployeeCounter {
  _id: string;
  sequence: number;
}

const EmployeeCounterSchema = new Schema<IEmployeeCounter>({
  _id: { type: String, required: true },
  sequence: { type: Number, required: true, default: 0 },
});

export const EmployeeCounterModel = mongoose.model<IEmployeeCounter>(
  'EmployeeCounter',
  EmployeeCounterSchema
);
