import dbClient from '../utils/db';
import authenticate from '../utils/auth';

const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const fs = require('fs');

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
    await fs.writeFile(filePath, data, { encoding: 'base64' }, (err) => {
      if (err) console.log(err);
    });
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
}

export default FilesController;
