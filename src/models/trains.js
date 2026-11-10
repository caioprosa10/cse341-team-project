//src/models/trains.js. 
import train from "./schemas/trains.js";

export async function getTrainById(id) {
  return train.findOne({ id }).lean();
}

export async function getAllTrains() {
  return train.find({}).lean();
}