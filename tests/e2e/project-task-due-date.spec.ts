import type { Project, Task } from '../../src/clients';
import { buildProject, buildTask } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn } from '../../src/utils/dates';

// Flow recorded in the web app: create a project, add a task to it, then pick a due date in the
// scheduler. The web app sends /sync commands (project_add, item_add, item_update); the test
// uses the matching REST endpoints.
test(
  'TC-016 A user creates a project, adds a task to it and schedules the task for a date',
  { tag: ['@TC-016', '@e2e'] },
  async ({ api, testData, accountTimezone }) => {
    const project = await test.step('Create a project', async () => {
      const payload = buildProject();
      const response = await api.projects.send('POST', 'projects', { body: payload });
      expect(response.status()).toBe(200);
      const created = (await response.json()) as Project;
      testData.track('project', created.id);
      expect(created).toMatchSchema(Schema.project);
      expect(created.name).toBe(payload.name);
      return created;
    });

    const taskPayload = buildTask({ project_id: project.id });

    const task = await test.step('Add a task without a due date to the project', async () => {
      const response = await api.tasks.send('POST', 'tasks', { body: taskPayload });
      expect(response.status()).toBe(200);
      const created = (await response.json()) as Task;
      testData.track('task', created.id);
      expect(created).toMatchSchema(Schema.task);
      expect(created.content).toBe(taskPayload.content);
      expect(created.project_id).toBe(project.id);
      expect(created.due).toBeNull();
      return created;
    });

    const dueDate = addDays(todayIn(accountTimezone), 6);

    await test.step('Schedule the task for a date', async () => {
      const response = await api.tasks.send('POST', `tasks/${task.id}`, {
        body: { due_date: dueDate },
      });
      expect(response.status()).toBe(200);
      const updated = (await response.json()) as Task;
      expect(updated).toMatchSchema(Schema.task);
      expect(updated.due).not.toBeNull();
      expect(updated.due?.date).toBe(dueDate);
    });

    await test.step('Load the task by ID and check it kept its project, text and due date', async () => {
      const response = await api.tasks.send('GET', `tasks/${task.id}`);
      expect(response.status()).toBe(200);
      const loaded = (await response.json()) as Task;
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(task.id);
      expect(loaded.project_id).toBe(project.id);
      expect(loaded.content).toBe(taskPayload.content);
      expect(loaded.due).not.toBeNull();
      expect(loaded.due?.date).toBe(dueDate);
      expect(loaded.due?.is_recurring).toBe(false);
    });

    await test.step('List the project tasks and find only the scheduled task', async () => {
      const tasks = await api.tasks.list({ project_id: project.id });
      expect(tasks.map((t) => t.id)).toEqual([task.id]);
      expect(tasks[0]?.due?.date).toBe(dueDate);
    });
  },
);
