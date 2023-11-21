import dbClient from './utils/db';

const Queue = require('bull');
const { ObjectId } = require('mongodb');
const imageThumbnail = require('image-thumbnail');
const fsPromise = require('fs').promises;

// create new instance of 'fileQueue' Queue
const fileQueue = new Queue('fileQueue');
// add a new worker onto the instance to process the jobs and generate thumbnails
fileQueue.process(async (job) => {
  // check if job has fileID
  if (!job.fileId) {
    throw new Error('Missing fileId');
  }
  // check if job has userId
  if (!job.userId) {
    throw new Error('Missing userId');
  }
  // use fileId and userId of job to check if file exists in DB
  let fileRequestedObjectId;
  try {
    fileRequestedObjectId = new ObjectId(job.fileId);
  } catch (err) {
    console.error(err);
  }
  const filesCollection = dbClient.db.collection('files');
  const fileRequested = await filesCollection.findOne({ _id: fileRequestedObjectId });
  if (!fileRequested || fileRequested.userId !== job.userId) {
    throw new Error('File not found');
  }
  // use async for-loop to iterate through width sizes
  const widths = [100, 250, 500];
  for await (const width of widths) {
    const options = { width };
    let thumbnail;
    // use thumbnail module to generate thumbnail based on width
    try {
      thumbnail = await imageThumbnail(fileRequested.localPath, options);
    } catch (err) {
      console.error(err);
    }
    // append size to end of filename, to store thumbnails locally
    const thumbPath = `${fileRequested.localPath}_${width}`;
    try {
      await fsPromise.writeFile(thumbPath, thumbnail);
    } catch (err) {
      console.error(err);
    }
  }
});
