import dbClient from '../utils/db';
import authenticate from '../utils/auth';

const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const prom = require('fs').promises;

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
    try {
      await prom.writeFile(filePath, data, { encoding: 'base64' });
    } catch (err) {
      console.log(err);
    }
    // COMMENTED-OUT CODE BELOW REDONE AS TRY-CATCH BLOCK ABOVE,
    // USING PROMISE-BASED (AWAITABLE) FILE WRITE FUNCTION
    // await fs.writeFile(filePath, data, { encoding: 'base64' }, (err) => {
    //   if (err) console.log(err);
    // });
    const result = await files.insertOne(newFile);

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
    // we'll make a reference to the files collection accessible via our mongo client
    const filesCollectionToQuery = dbClient.db.collection('files');
    // now let's get the query parameters from the query, if they are provided.
    // first, the parentId, which will default to 0 (root) but we'll declare it and check first
    let parentIdToSearch;
    // and if they have provided one, we will use that instead
    if (req.query.parentId && ObjectId.isValid(req.query.parentId)) {
      parentIdToSearch = new ObjectId(req.query.parentId);
    } else {
      parentIdToSearch = '0';
    }
    // and let's make our query ready to put into the aggregate command later
    const matchAggregate = { userId: userRequesting._id, parentId: parentIdToSearch };
    // secondly, we will get the page of results they want (if they provide it).
    // we set the default value to be 0
    let page = 0;
    // Then we'll check to see if it's included in the query.
    // if it's not an integer, parseInt will return NaN which == false
    if (parseInt(req.query.page, 10)) {
      // set page if they've given us a valid one
      page = parseInt(req.query.page, 10);
    }
    // and turn page into a skip parameter by multiplying it by the max # records per page
    const skipParameter = page * 20;
    // we'll put these all together into an aggregate command to make use of mongo's pipeline
    const mongoAggregateCommand = [
      { $match: matchAggregate },
      { $skip: skipParameter },
      { $limit: 20 },
    ];
    // and execute the command on the collection we made accessible earlier, putting results in an
    // array which we will then be able to return as a list of files to the user
    const filesToReturn = await filesCollectionToQuery.aggregate(mongoAggregateCommand).toArray();
    // and return it
    return res.status(200).json(filesToReturn);
  }
}

export default FilesController;
