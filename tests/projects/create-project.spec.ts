import type { Project } from '../../src/clients';
import { buildProject } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created and comes back under the name that was entered',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    const payload = buildProject();

    const created = await test.step('Create a project with a unique name', async () => {
      const response = await api.projects.send('POST', 'projects', { body: payload });
      expect(response.status()).toBe(200);
      const project = (await response.json()) as Project;
      testData.track('project', project.id);
      return project;
    });

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.project);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe(payload.name);
    });

    await test.step('Load the project by ID and check its name', async () => {
      const response = await api.projects.send('GET', `projects/${created.id}`);
      expect(response.status()).toBe(200);
      const loaded = (await response.json()) as Project;
      expect(loaded).toMatchSchema(Schema.project);
      expect(loaded.id).toBe(created.id);
      expect(loaded.name).toBe(payload.name);
    });
  },
);
