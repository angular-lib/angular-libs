import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';

export interface NgAddSchema {
  project?: string;
}

interface WorkspaceProject {
  projectType?: string;
  sourceRoot?: string;
  root?: string;
}

export function ngAdd(options: NgAddSchema = {}): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('Running ng-add for @angular-libs/event-bus');

    const { name, project } = resolveProject(tree, options.project);
    context.logger.info(`Using project "${name}"`);

    const projectPath = project.sourceRoot || 'src';

    const serviceContent = `import { Injectable } from '@angular/core';
import { ALEventBus } from '@angular-libs/event-bus';
import { AppEventMap } from './event-bus.models';

@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap> {}
`;
    const servicePath = `${projectPath}/app/event-bus/app-event-bus.service.ts`;
    writeIfMissing(tree, context, servicePath, serviceContent);

    const modelsContent = `export interface AppEventMap {
  'user:login': { userId: number, userName: string };
}
`;
    const modelsPath = `${projectPath}/app/event-bus/event-bus.models.ts`;
    writeIfMissing(tree, context, modelsPath, modelsContent);

    return tree;
  };
}

function writeIfMissing(
  tree: Tree,
  context: SchematicContext,
  path: string,
  content: string,
): void {
  if (tree.exists(path)) {
    context.logger.warn(`File ${path} already exists, skipping creation.`);
    return;
  }
  tree.create(path, content);
}

function resolveProject(
  tree: Tree,
  requestedName?: string,
): { name: string; project: WorkspaceProject } {
  const angularJson = tree.read('angular.json');
  if (!angularJson) {
    throw new SchematicsException(
      'Could not find angular.json in the workspace.',
    );
  }

  const workspace = JSON.parse(angularJson.toString());
  const projects = (workspace.projects || {}) as Record<string, WorkspaceProject>;
  const projectNames = Object.keys(projects);

  if (requestedName) {
    const project = projects[requestedName];
    if (!project) {
      throw new SchematicsException(
        `Project "${requestedName}" was not found in angular.json.`,
      );
    }
    return { name: requestedName, project };
  }

  const defaultProject =
    workspace.defaultProject ||
    (workspace.extensions && workspace.extensions.defaultProject);
  if (typeof defaultProject === 'string' && projects[defaultProject]) {
    return { name: defaultProject, project: projects[defaultProject] };
  }

  const applications = projectNames.filter(
    (name) => projects[name]?.projectType === 'application',
  );
  if (applications.length === 1) {
    return { name: applications[0], project: projects[applications[0]] };
  }
  if (applications.length > 1) {
    throw new SchematicsException(
      `Multiple application projects found (${applications.join(', ')}). Pass --project=<name>.`,
    );
  }

  if (projectNames.length === 1) {
    return { name: projectNames[0], project: projects[projectNames[0]] };
  }

  throw new SchematicsException(
    'Could not determine an Angular application project. Pass --project=<name>.',
  );
}
