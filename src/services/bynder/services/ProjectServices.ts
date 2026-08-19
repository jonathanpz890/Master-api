import { Request, Response } from 'express';
import { Project } from '../db/models/Project.model.js';
import { List } from '../db/models/List.model.js';
import { logger } from '../logger.js';

const LIST_FIELDS = [
  { name: 'Title', type: 'text', required: true, field: 'title' },
  {
    name: 'Status',
    type: 'select',
    options: ['Todo', 'Doing', 'Done'],
    defaultValue: 'Todo',
    field: 'status',
  },
  {
    name: 'Priority',
    type: 'select',
    options: ['Low', 'Medium', 'High'],
    defaultValue: 'Medium',
    field: 'priority',
  },
  { name: 'Due Date', type: 'date', field: 'dueDate' },
];

const createTaskList = async (title: string, userId: any, projectId: any, color: string) =>
  List.create({
    title,
    userId,
    projectId,
    type: 'project_tasks',
    icon: 'projects.png',
    fields: LIST_FIELDS,
    settings: { viewType: 'list', colorTheme: color, checkable: true },
  });

const populateProject = (q: any) =>
  q.populate('taskLists.listId').populate('taskList').populate('notes');

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const projects = await Project.find({ userId })
      .populate('taskLists.listId')
      .populate('taskList')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (error) {
    logger.error('Fetching projects failed', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    let project: any = await populateProject(Project.findOne({ _id: id, userId }));

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    let dirty = false;

    // Migrate old taskList → taskLists[phaseId:null] if needed
    if (
      project.taskList &&
      (!project.taskLists || !project.taskLists.some((tl: any) => !tl.phaseId))
    ) {
      project.taskLists = project.taskLists || [];
      project.taskLists.push({ phaseId: null, listId: project.taskList });
      dirty = true;
    }

    // Lazy-create general task list if missing
    if (!project.taskLists || !project.taskLists.some((tl: any) => !tl.phaseId)) {
      const list = await createTaskList(
        `${project.title} Tasks`,
        userId,
        project._id,
        project.color || '#8b5cf6',
      );
      project.taskLists = [...(project.taskLists || []), { phaseId: null, listId: list._id }];
      project.taskList = list._id; // keep in sync for compat
      dirty = true;
    }

    // Lazy-create a task list for each phase that doesn't have one
    for (const phase of project.phases || []) {
      const phaseId = phase._id?.toString();
      if (!phaseId) continue;
      const hasPhaseList = (project.taskLists || []).some((tl: any) => tl.phaseId === phaseId);
      if (!hasPhaseList) {
        const list = await createTaskList(
          `${phase.title} Tasks`,
          userId,
          project._id,
          phase.color || project.color || '#8b5cf6',
        );
        project.taskLists = [...(project.taskLists || []), { phaseId, listId: list._id }];
        dirty = true;
      }
    }

    if (dirty) {
      await project.save();
      project = await populateProject(Project.findById(id));
    }

    res.json({ project });
  } catch (error) {
    logger.error('Fetching project failed', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const projectData = { ...req.body, userId };
    const newProject: any = new Project(projectData);
    await newProject.save();

    const generalList = await createTaskList(
      `${newProject.title} Tasks`,
      userId,
      newProject._id,
      newProject.color || '#8b5cf6',
    );
    newProject.taskList = generalList._id;
    newProject.taskLists = [{ phaseId: null, listId: generalList._id }];

    // Create lists for any phases included at creation time
    for (const phase of newProject.phases || []) {
      const phaseId = phase._id?.toString();
      if (!phaseId) continue;
      const list = await createTaskList(
        `${phase.title} Tasks`,
        userId,
        newProject._id,
        phase.color || newProject.color || '#8b5cf6',
      );
      newProject.taskLists.push({ phaseId, listId: list._id });
    }

    await newProject.save();
    res.status(201).json({ project: newProject });
  } catch (error) {
    logger.error('Creating project failed', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { _id, __v, userId: _uid, createdAt, ...updates } = req.body;

    // When new phases are added, create their task lists
    if (updates.phases) {
      const existingProject: any = await Project.findOne({ _id: id, userId });
      if (existingProject) {
        const existingPhaseIds = new Set(
          (existingProject.taskLists || []).map((tl: any) => tl.phaseId),
        );
        const newLists: any[] = [...(existingProject.taskLists || [])];

        for (const phase of updates.phases) {
          const phaseId = phase._id?.toString();
          if (phaseId && !existingPhaseIds.has(phaseId)) {
            const list = await createTaskList(
              `${phase.title} Tasks`,
              userId,
              id,
              phase.color || existingProject.color || '#8b5cf6',
            );
            newLists.push({ phaseId, listId: list._id });
          }
        }
        updates.taskLists = newLists;
      }
    }

    const project = await populateProject(
      Project.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }),
    );

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    logger.error('Updating project failed', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const uploadProjectFile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const file = req.file as any;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const newFile = {
      name: file.originalname,
      url: `${process.env.BYNDER_SERVER_URL}/images/${file.filename}`,
      fileType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    };

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      { $push: { files: newFile } },
      { new: true },
    );

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const savedFile = project.files[project.files.length - 1];
    res.json({ file: savedFile });
  } catch (error) {
    logger.error('Uploading project file failed', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

export const deleteProjectFile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id, fileId } = req.params;

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      { $pull: { files: { _id: fileId } } },
      { new: true },
    );

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Deleting project file failed', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Deleting project failed', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
