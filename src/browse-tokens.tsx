import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import ManageProjects, { ProjectForm } from "./manage-projects";
import { Project, useActiveProjectId, useProjects } from "./store";
import { loadTokens, startsWith, Token } from "./tokens";

export default function Command() {
  const [projects] = useProjects();
  const [activeId, setActiveId] = useActiveProjectId();
  const project = projects.find((p) => p.id === activeId) ?? projects[0];

  if (!project) {
    return (
      <Grid>
        <Grid.EmptyView
          title="No Projects"
          description="Add a project pointing at your style-dictionary token files"
          actions={
            <ActionPanel>
              <Action.Push title="Add Project" icon={Icon.Plus} target={<ProjectForm />} />
            </ActionPanel>
          }
        />
      </Grid>
    );
  }

  const accessory = (
    <Grid.Dropdown tooltip="Project" value={project.id} onChange={setActiveId}>
      {projects.map((p) => (
        <Grid.Dropdown.Item key={p.id} value={p.id} title={p.name} />
      ))}
    </Grid.Dropdown>
  );
  return <Browse key={project.id} project={project} accessory={accessory} />;
}

function Browse({ project, accessory }: { project: Project; accessory: Grid.Props["searchBarAccessory"] }) {
  const { data: tokens = [], isLoading } = useCachedPromise(loadTokens, [project.dirs], {
    failureToastOptions: { title: `Failed to load tokens for ${project.name}` },
  });
  return <Level project={project} tokens={tokens} path={[]} isLoading={isLoading} accessory={accessory} />;
}

type LevelProps = {
  project: Project;
  tokens: Token[];
  path: string[];
  isLoading?: boolean;
  accessory?: Grid.Props["searchBarAccessory"];
};

function Level({ project, tokens, path, isLoading, accessory }: LevelProps) {
  const inScope = tokens.filter((t) => startsWith(t.path, path));
  const leaves = inScope.filter((t) => t.path.length === path.length + 1);
  const groups = [...new Set(inScope.filter((t) => t.path.length > path.length + 1).map((t) => t.path[path.length]))];

  return (
    <Grid
      columns={5}
      isLoading={isLoading}
      navigationTitle={path.length ? path.join(".") : project.name}
      searchBarAccessory={accessory}
    >
      <Grid.Section title="Groups">
        {groups.map((g) => {
          const groupPath = [...path, g];
          return (
            <Grid.Item
              key={g}
              title={g}
              subtitle={`${inScope.filter((t) => startsWith(t.path, groupPath)).length} tokens`}
              content={Icon.Folder}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Open Group"
                    icon={Icon.ArrowRight}
                    target={<Level project={project} tokens={tokens} path={groupPath} />}
                  />
                  <Action.CopyToClipboard title="Copy Name" content={groupPath.join(".")} />
                  <Action.Push title="Manage Projects" icon={Icon.Gear} target={<ManageProjects />} />
                </ActionPanel>
              }
            />
          );
        })}
      </Grid.Section>
      <Grid.Section title="Tokens">
        {leaves.map((t) => (
          <Grid.Item
            key={t.path.join(".")}
            title={t.path[t.path.length - 1]}
            subtitle={t.value}
            content={Icon.Dot}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Value" content={t.value} />
                <Action.CopyToClipboard title="Copy Name" content={t.path.join(".")} />
                {t.alias && <Action.CopyToClipboard title="Copy Alias" content={t.alias} />}
                <Action.Push title="Manage Projects" icon={Icon.Gear} target={<ManageProjects />} />
              </ActionPanel>
            }
          />
        ))}
      </Grid.Section>
    </Grid>
  );
}
