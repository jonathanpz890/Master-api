import { Request, Response } from 'express';
import mongoose from 'mongoose-bynder';
import { Template } from '../db/models/Template.model.js';
import { List } from '../db/models/List.model.js';
import User from '../db/models/User.model.js';
import { v4 as uuidv4 } from 'uuid';
import { processAndSaveUploadedImage } from '../utils/imageUtils.js';
import { logger } from '../logger.js';

/**
 * Helper to find a list and optionally an entry within it.
 * Centralizes the repeated find/findIndex logic.
 */
const findListAndEntry = async (listId: string, userId: string, entryId?: string) => {
  const list = await List.findOne({ _id: listId, userId });
  if (!list) return { list: null, entryIndex: -1, entry: null };

  let entryIndex = -1;
  let entry = null;

  if (entryId) {
    entryIndex = list.entries.findIndex(
      (e) => (e as any).id === entryId || (e as any)._id?.toString() === entryId,
    );
    entry = entryIndex !== -1 ? list.entries[entryIndex] : null;
  }

  return { list, entryIndex, entry };
};

export const getLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { projectId } = req.query;
    const query: any = { userId };
    if (projectId) {
      query.projectId = projectId;
    } else {
      query.projectId = { $in: [null, undefined] };
    }

    const lists = await List.find(query);
    res.status(200).json({ lists });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getListById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId } = req.params;
    const userId = (req.user as any)._id;

    const list = await List.findOne({ _id: listId, userId });
    res.status(200).json({ list });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, title, fields, settings, projectId, type, icon, entries, categories } =
      req.body;
    const userId = (req.user as any)._id;

    let listData: any = {
      title: title.trim(),
      userId,
      projectId: projectId || null,
      fields: fields || [],
      categories: categories || [],
      settings: settings || { viewType: 'list', colorTheme: '#8b5cf6' },
      type: type || 'custom',
      icon: icon || 'projects.png',
      entries: entries || [],
    };

    if (templateId) {
      const template = await Template.findOne({ _id: templateId });
      if (template) {
        const { _id, ...tData } = template.toObject();
        listData = {
          ...tData,
          ...listData,
          fields: fields || tData.fields,
          settings: { ...tData.settings, ...listData.settings },
          type: tData.name,
          icon: icon || tData.icon,
        };
      }
    }

    if (listData.type === 'groceries') {
      listData.settings = { ...listData.settings, checklist: true };
    }

    if (listData.settings?.isDefault) {
      await List.updateMany(
        { userId, type: listData.type, 'settings.isDefault': true },
        { $set: { 'settings.isDefault': false } },
      );
    }

    if (listData.entries && listData.entries.length > 0) {
      listData.entries = listData.entries.map((entry: any) => ({
        id: uuidv4(),
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date(),
        files: [],
      }));
    }

    const newList = await List.create(listData);

    await User.updateOne(
      { _id: userId },
      {
        $push: { lists: newList._id },
      },
    );

    res.status(200).json({ listId: newList._id });
  } catch (error: any) {
    logger.error('Creating list failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createListEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId } = req.params;
    const { entry } = req.body;
    const userId = (req.user as any)._id;

    const newEntry = {
      id: uuidv4(),
      ...entry,
      createdAt: new Date(),
      updatedAt: new Date(),
      files: entry.files || [],
    };

    const list = await List.findOneAndUpdate(
      { _id: listId, userId },
      { $push: { entries: newEntry } },
      { new: true },
    );

    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }

    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Creating list entry failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteListEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, entryId } = req.params;
    const userId = (req.user as any)._id;

    let entryObjectId: mongoose.Types.ObjectId | undefined;
    try {
      entryObjectId = new mongoose.Types.ObjectId(entryId);
    } catch (_) {}

    const pullCondition = entryObjectId
      ? { $or: [{ _id: entryObjectId }, { id: entryId }] }
      : { id: entryId };

    const list = await List.findOneAndUpdate(
      { _id: listId, userId },
      { $pull: { entries: pullCondition } },
      { new: true },
    );

    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }

    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Deleting list entry failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, entryId } = req.params;
    const { update } = req.body;
    const userId = (req.user as any)._id;

    delete update._id;
    delete update.id;

    const setFields: Record<string, any> = { 'entries.$[entry].updatedAt': new Date() };
    for (const [k, v] of Object.entries(update)) {
      setFields[`entries.$[entry].${k}`] = v;
    }

    let entryObjectId: mongoose.Types.ObjectId | undefined;
    try {
      entryObjectId = new mongoose.Types.ObjectId(entryId);
    } catch (_) {}

    const arrayFilter = entryObjectId
      ? [{ $or: [{ 'entry._id': entryObjectId }, { 'entry.id': entryId }] }]
      : [{ 'entry.id': entryId }];

    const list = await List.findOneAndUpdate(
      { _id: listId, userId },
      { $set: setFields },
      { arrayFilters: arrayFilter, new: true },
    );

    if (!list) {
      res.status(404).json({ message: 'List or entry not found' });
      return;
    }

    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Updating list entry failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadListEntryFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, entryId } = req.params;
    const file = req.file;
    const userId = (req.user as any)._id;

    if (!file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { list, entryIndex, entry } = await findListAndEntry(listId, userId, entryId);
    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }
    if (entryIndex === -1) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    const imageUrl = await processAndSaveUploadedImage(file.buffer);

    const fileData = {
      name: file.originalname,
      url: imageUrl,
      type: 'image/jpeg',
      size: file.size,
      uploadedAt: new Date(),
    };

    const entryObj =
      typeof (entry as any).toObject === 'function' ? (entry as any).toObject() : entry;

    if (!entryObj.files) entryObj.files = [];
    entryObj.files.push(fileData);

    list.entries[entryIndex] = entryObj;
    list.markModified('entries');

    await list.save();
    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Uploading list file failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListEntryWithFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, entryId } = req.params;
    const file = req.file;
    const userId = (req.user as any)._id;

    if (!file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { list, entryIndex, entry } = await findListAndEntry(listId, userId, entryId);
    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }
    if (entryIndex === -1) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    const imageUrl = await processAndSaveUploadedImage(file.buffer);
    const entryObj =
      typeof (entry as any).toObject === 'function' ? (entry as any).toObject() : entry;

    list.entries[entryIndex] = {
      ...entryObj,
      image: imageUrl,
      updatedAt: new Date(),
    };

    list.markModified('entries');
    await list.save();
    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Updating list entry with file failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const clearListEntryImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, entryId } = req.params;
    const userId = (req.user as any)._id;

    const { list, entryIndex, entry } = await findListAndEntry(listId, userId, entryId);
    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }
    if (entryIndex === -1) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    const entryObj =
      typeof (entry as any).toObject === 'function' ? (entry as any).toObject() : entry;

    list.entries[entryIndex] = {
      ...entryObj,
      image: '',
      updatedAt: new Date(),
    };

    list.markModified('entries');
    await list.save();
    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Clearing list entry image failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId } = req.params;
    const userId = (req.user as any)._id;

    const list = await List.findOneAndDelete({ _id: listId, userId });
    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }

    await User.updateOne(
      { _id: userId },
      {
        $pull: { lists: listId },
      },
    );

    res.status(200).json({ message: 'List deleted', listId });
  } catch (error: any) {
    logger.error('Deleting list failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId } = req.params;
    const { update: rawUpdate } = req.body;
    const userId = (req.user as any)._id;

    const list = await List.findOne({ _id: listId, userId });

    if (!list) {
      res.status(404).json({ message: 'List not found' });
      return;
    }

    // Strip fields that must never be overwritten by the client
    const { _id, __v, userId: _uid, createdAt, updatedAt: _ua, ...update } = rawUpdate ?? {};

    // If this update is setting a list as default, reset others of the same type
    if (update.settings?.isDefault) {
      await List.updateMany(
        {
          userId,
          type: list.type,
          _id: { $ne: listId },
          'settings.isDefault': true,
        },
        { $set: { 'settings.isDefault': false } },
      );
    }

    // Apply updates recursively for nested objects like settings
    Object.keys(update).forEach((key) => {
      if (update[key] && typeof update[key] === 'object' && !Array.isArray(update[key])) {
        // Handle nested objects by merging them
        (list as any)[key] = { ...(list.toObject() as any)[key], ...update[key] };
      } else {
        (list as any)[key] = update[key];
      }
    });

    if (update.entries) {
      list.markModified('entries');
    }

    await list.save();

    res.status(200).json({ list });
  } catch (error: any) {
    logger.error('Updating list failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
