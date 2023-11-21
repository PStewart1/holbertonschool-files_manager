import dbClient from '../utils/db';
import authenticate from '../utils/auth';

const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const prom = require('fs').promises;
const mime = require('mime-types');
const Queue = require('bull');

class FilesController {
  static async postUpload(req, res) {
    // authenticate user with token, calling abstracted authentication logic
    let user;
    try {
      user = await authenticate(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // check if body includes name
    if (!req.body.name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    // check if type is included, and of accepted types
    const types = ['folder', 'file', 'image'];
    if (!req.body.type || !types.includes(req.body.type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    // check if data is included, if type is not folder
    if (!req.body.data && req.body.type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    // set some parameters from default and body
    const { data } = req.body;
    let parentId = 0;
    const files = dbClient.db.collection('files');
    // if parentId is included, checks to make sure folder exists, and is correct type
    if (req.body.parentId) {
      const currentUserObjectId = new ObjectId(req.body.parentId);
      const fileExists = await files.findOne({ _id: currentUserObjectId });
      if (!fileExists) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (fileExists.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
      parentId = req.body.parentId;
    }
    // check if isPublic is included
    let isPublic = false;
    if (req.body.isPublic) {
      isPublic = req.body.isPublic;
    }
    // create new file object
    const newFile = {
      userId: user._id,
      name: req.body.name,
      type: req.body.type,
      isPublic,
      parentId,
    };
    // if type is 'folder', insert into db, and return details
    if (req.body.type === 'folder') {
      const result = await files.insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId,
        userId: newFile.userId,
        name: newFile.name,
        type: newFile.type,
        isPublic: newFile.isPublic,
        parentId: newFile.parentId,
      });
    }
    // if folder path is specified in env varaiable, set folderPath to it, otherwise default
    let folderPath = '/tmp/files_manager';
    if (process.env.FOLDER_PATH) {
      folderPath = process.env.FOLDER_PATH;
    }
    // check if directory exists, if not make it
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    // create new uuid for file name
    const fileName = uuidv4();
    const filePath = `${folderPath}/${fileName}`;
    // add file path to file properties
    newFile.localPath = filePath;
    // write the file locally and insert into db, then return details
    // USING PROMISE-BASED (AWAITABLE) FILE WRITE FUNCTION
    try {
      await prom.writeFile(filePath, data, { encoding: 'base64' });
    } catch (err) {
      console.log(err);
    }
    const result = await files.insertOne(newFile);
    // add new job into queue for generating thumbnails for image
    if (newFile.type === 'image') {
      const fileQueue = new Queue('fileQueue');
      await fileQueue.add({
        userId: newFile.userId,
        fileId: result.insertedId,
      });
    }

    return res.status(201).json({
      id: result.insertedId,
      userId: newFile.userId,
      name: newFile.name,
      type: newFile.type,
      isPublic: newFile.isPublic,
      parentId: newFile.parentId,
      localPath: newFile.localPath,
    });
  }

  static async getShow(req, res) {
    // let's declare a variable to hold the user object located based on the request
    let userRequesting;
    // pass it to our good friend authenticate to return the user object
    try {
      userRequesting = await authenticate(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // now let's grab the file identifier from the url parameter
    const fileIdentifier = req.params.id;
    // and convert it into a ObjectId, which is how MongoDB stores unique doc identifiers
    let fileObjectId;
    try {
      fileObjectId = new ObjectId(fileIdentifier);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // and then try to get the file document from the databaseby matching both the
    // file id and the user's id (so we know they have permission)
    const fileToReturn = await filesCollectionToQuery.findOne(
      { _id: fileObjectId, userId: userRequesting._id },
    );
    if (!fileToReturn) {
      return res.status(404).json({ error: 'Not found' });
    }
    // if successful, we will return the file document (note: not the file itself!)
    return res.status(200).json(fileToReturn);
  }

  static async getIndex(req, res) {
    // let's declare a variable to hold the user object located based on the request
    let userRequesting;
    // pass it to our good friend authenticate to return the user object
    try {
      userRequesting = await authenticate(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // get the parentId and page (if it's there, otherwise 0) from the request
    const { parentId, page = 0 } = req.query;
    // and turn page into a skip parameter by multiplying it by the max # records per page
    const skipParameter = parseInt(page, 10) * 20;
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // Prepare match condition for MongoDB aggregation, starting with default (no parentId)
    let matchCondition = { userId: userRequesting._id };
    // if there is a valid parentId (folder), we'll add that
    if (parentId && ObjectId.isValid(parentId)) {
      matchCondition = { ...matchCondition, parentId: new ObjectId(parentId) };
    }
    // we'll put these all together into an aggregate command to make use of mongo's pipeline
    const mongoAggregateCommand = [
      { $match: matchCondition },
      { $skip: skipParameter },
      { $limit: 20 },
    ];
    // and execute the command on the collection we made accessible earlier, putting results in an
    // array which we will then be able to return as a list of files to the user
    const filesToReturn = await filesCollectionToQuery.aggregate(mongoAggregateCommand).toArray();
    // and format it
    const formattedFiles = filesToReturn.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));
    // and finally return it
    return res.status(200).json(formattedFiles);
  }

  static async putPublish(req, res) {
    // let's declare a variable to hold the user object located based on the request
    let userRequesting;
    // pass it to our good friend authenticate to return the user object
    try {
      userRequesting = await authenticate(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // let's grab the file id from the URL parameter
    const fileRequestedId = req.params.id;
    // and try to convert it to a mongodb ObjectId type
    let fileRequestedObjectId;
    try {
      fileRequestedObjectId = new ObjectId(fileRequestedId);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
    // try to access the file using the file's id and the requesting user's id
    const fileToPublish = await filesCollectionToQuery.findOne(
      { _id: fileRequestedObjectId, userId: userRequesting._id },
    );
    // if the file isn't there or accessible, return an error
    if (!fileToPublish) {
      return res.status(404).json({ error: 'Not found' });
    }
    // change the isPublic attribute to be 'true'
    await filesCollectionToQuery.updateOne(
      { _id: fileRequestedObjectId }, { $set: { isPublic: true } },
    );
    // we actually have to grab it again instead of using 'fileToPublish', because that
    // actually references the state of the file before we updated it. the contents of the
    // variable fileToPublish are not actually updated by that operation. Actually!
    const fileThatWasJustPublished = await filesCollectionToQuery.findOne(
      { _id: fileRequestedObjectId },
    );
    return res.status(200).json(fileThatWasJustPublished);
  }

  static async putUnpublish(req, res) {
    // let's declare a variable to hold the user object located based on the request
    let userRequesting;
    // pass it to our good friend authenticate to return the user object
    try {
      userRequesting = await authenticate(req);
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // let's grab the file id from the URL parameter
    const fileRequestedId = req.params.id;
    // and try to convert it to a mongodb ObjectId type
    let fileRequestedObjectId;
    try {
      fileRequestedObjectId = new ObjectId(fileRequestedId);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
    // try to access the file using the file's id and the requesting user's id
    const fileToUnpublish = await filesCollectionToQuery.findOne(
      { _id: fileRequestedObjectId, userId: userRequesting._id },
    );
    // if the file isn't there or accessible, return an error
    if (!fileToUnpublish) {
      return res.status(404).json({ error: 'Not found' });
    }
    // change the isPublic attribute to be 'false'
    await filesCollectionToQuery.updateOne(
      { _id: fileRequestedObjectId }, { $set: { isPublic: false } },
    );
    // we actually have to grab it again instead of using 'fileToUnpublish', because that
    // actually references the state of the file before we updated it. the contents of the
    // variable fileToUnpublish are not actually updated by that operation. Actually!
    const fileThatWasJustUnpublished = await filesCollectionToQuery.findOne(
      { _id: fileRequestedObjectId },
    );
    return res.status(200).json(fileThatWasJustUnpublished);
  }

  static async getFile(req, res) {
    // let's grab the file id from the URL parameter
    const fileRequestedId = req.params.id;
    // and try to convert it to a mongodb ObjectId type
    let fileRequestedObjectId;
    try {
      fileRequestedObjectId = new ObjectId(fileRequestedId);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // and try to retrive the file
    const fileRequested = await filesCollectionToQuery.findOne({ _id: fileRequestedObjectId });
    if (!fileRequested) {
      // not there? oh well!
      return res.status(404).json({ error: 'Not found' });
    }
    // if it's not public and the requesting user isn't authenticated or the owner? error.
    if (fileRequested.isPublic === false) {
      // we need to retrieve the user from the token, in order to authenticate them as file owner
      let userRequesting;
      try {
        userRequesting = await authenticate(req);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }
      const fileOwner = fileRequested.userId.toString();
      if (fileOwner !== userRequesting._id.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    // make sure they're not requesting a folder, which would be silly
    if (fileRequested.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }
    // add support for returning thumbnail, if 'size' query is present
    let { localPath } = fileRequested;
    if (fileRequested.type === 'image' && req.query.size) {
      localPath += `_${req.query.size}`;
    }
    // throw an error if the file isn't locally present
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    // with all those painful error checks behind us, it is now time to check the type
    const fileRequestedMimeType = mime.lookup(fileRequested.name);
    // set the header
    res.setHeader('Content-Type', fileRequestedMimeType);
    // grab the content of the actual file
    const fileRequestedInnards = fs.readFileSync(localPath);
    // give it graciously to the user
    return res.status(200).send(fileRequestedInnards);
  }
}

export default FilesController;
