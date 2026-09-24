import type { Task } from '../../src/clients';
import { buildTask } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    const payload = buildTask();

    const created = await test.step('Create a task with unique content', async () => {
      const response = await api.tasks.send('POST', 'tasks', { body: payload });
      expect(response.status()).toBe(200);
      const task = (await response.json()) as Task;
      testData.track('task', task.id);
      return task;
    });

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.id).toBeTruthy();
      expect(created.content).toBe(payload.content);
    });

    await test.step('Load the task by ID and check its text', async () => {
      const response = await api.tasks.send('GET', `tasks/${created.id}`);
      expect(response.status()).toBe(200);
      const loaded = (await response.json()) as Task;
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(payload.content);
    });
  },
);
