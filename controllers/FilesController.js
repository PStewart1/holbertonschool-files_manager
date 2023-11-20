import { types } from 'mime-types';
import UsersController from '../controllers/UsersController';
import dbClient from '../utils/db';

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

    if (req.body.type == 'folder') {

    }
    else {

    }
    const newFile = {
      userId: user.id,
      name: req.body.name,
      type: req.body.type,
      parentId: parentId,
      // isPublic: req.body.isPublic,
      // data: req.body.data,
    }
  
  } 

}

export default FilesController;
