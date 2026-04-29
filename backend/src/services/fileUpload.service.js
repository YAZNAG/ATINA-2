const { deleteFile, getFilePath } = require('../utils/fileStorage');

class FileUploadService {
  extractPaths(files, folder) {
    const result = {};
    if (files?.image?.[0]) result.image_path = getFilePath(files.image[0], folder);
    if (files?.icon?.[0]) result.icon_path = getFilePath(files.icon[0], folder);
    if (files?.logo?.[0]) result.logo = getFilePath(files.logo[0], folder);
    return result;
  }

  replaceIfNew(existing, newFile, folder) {
    if (!newFile) return existing;
    if (existing) deleteFile(existing);
    return getFilePath(newFile, folder);
  }

  deleteFileByPath(filePath) {
    deleteFile(filePath);
  }
}

module.exports = new FileUploadService();
