import UsersController from '../controllers/UsersController';
import dbClient from '../utils/db';
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class FilesController {
  static async postUpload(req, res) {
    const user = await UsersController.getMe(req, res);
    
    if (!req.body.name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    types = ['folder','file','image'];
    if (!req.body.type || !types.includes(req.body.type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!req.body.data && req.body.type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    // const data = Buffer.from(req.body.data, 'base64').toString()
    const data = req.body.data;
    let parentId = 0;
    if (req.body.parentId) {
      const files = dbClient.db.collection('files');
      const fileExists = await files.findOne({ parentId: req.body.parentId });
      if (!fileExists) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      else if (fileExists.type !== 'folder') {
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
      userId: user.id,
      name: req.body.name,
      type: req.body.type,
      isPublic: isPublic,
      parentId: parentId,
      // localPath: filePath
    }

    if (req.body.type == 'folder') {
      const result = await files.insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, userId: user.id, name: newFile.name, type: newFile.type, isPublic: newFile.isPublic, parentId: newFile.parentId});
    }
    else {
      if (process.env.FOLDER_PATH) {
        const folderPath = process.env.FOLDER_PATH;
      }
      else {
        const folderPath = '/tmp/files_manager';
      }
      const filePath = `${folderPath}/${fileName}`;
      newFile.localPath = filePath;
      fs.writeFile(filePath, data, (err) => {
        if (err) 
          console.log(err); 
      })
      const result = await files.insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, userId: user.id, name: newFile.name, type: newFile.type, isPublic: newFile.isPublic, parentId: newFile.parentId, localPath: newFile.localPath});
    }
  } 
}

export default FilesController;
