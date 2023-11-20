import UsersController from './UsersController';
import dbClient from '../utils/db';

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class FilesController {
  static async postUpload(req, res) {
    const user = await UsersController.authenticate(req, res);

    if (!req.body.name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    const types = ['folder', 'file', 'image'];
    if (!req.body.type || !types.includes(req.body.type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!req.body.data && req.body.type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    // const data = Buffer.from(req.body.data, 'base64').toString()
    const { data } = req.body;
    let parentId = 0;
    const files = dbClient.db.collection('files');
    if (req.body.parentId) {
      const fileExists = await files.findOne({ parentId: req.body.parentId });
      if (!fileExists) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (fileExists.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
      parentId = req.body.parentId;
    }
    let isPublic = false;
    if (req.body.isPublic) {
      isPublic = req.body.isPublic;
    }
    const fileName = uuidv4();

    const newFile = {
      userId: user._id,
      name: req.body.name,
      type: req.body.type,
      isPublic,
      parentId,
      // localPath: filePath
    };

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

    let folderPath = '/tmp/files_manager';
    if (process.env.FOLDER_PATH) {
      folderPath = process.env.FOLDER_PATH;
    }
    const filePath = `${folderPath}/${fileName}`;
    newFile.localPath = filePath;
    await fs.writeFile(filePath, data, { encoding: 'base64' }, (err) => {
      if (err) console.log(err);
    });
    const result = await files.insertOne(newFile);
    console.log(user);
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
