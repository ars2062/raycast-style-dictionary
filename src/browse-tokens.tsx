import { Action, ActionPanel, Grid, Icon, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { groupPreview, preview } from "./preview";
import ManageProjects, { ProjectForm } from "./manage-projects";
import { Pin, Project, useActiveProjectId, usePins, useProjects } from "./store";
import { parseTemplates, renderTemplates } from "./templates";
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

const slotKey = (slot: number) => String(slot + 1) as Keyboard.KeyEquivalent;
const openShortcut = (slot: number): Keyboard.Shortcut => ({
  macOS: { modifiers: ["cmd"], key: slotKey(slot) },
  Windows: { modifiers: ["ctrl"], key: slotKey(slot) },
});
const pinShortcut = (slot: number): Keyboard.Shortcut => ({
  macOS: { modifiers: ["cmd", "opt"], key: slotKey(slot) },
  Windows: { modifiers: ["ctrl", "alt"], key: slotKey(slot) },
});

function Level({ project, tokens, path, isLoading, accessory }: LevelProps) {
  const [search, setSearch] = useState("");
  const [pins, setPins] = usePins(project.id);
  const templates = parseTemplates(project.templates);
  const inScope = tokens.filter((t) => startsWith(t.path, path));
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const leaves = terms.length
    ? inScope.filter((t) => {
        const haystack = `${t.path.join(".")} ${t.value} ${t.alias ?? ""}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
    : inScope.filter((t) => t.path.length === path.length + 1);
  const groups = terms.length
    ? []
    : [...new Set(inScope.filter((t) => t.path.length > path.length + 1).map((t) => t.path[path.length]))];

  const findToken = (p: string[]) => tokens.find((t) => t.path.join(".") === p.join("."));
  const childrenOf = (p: string[]) => tokens.filter((t) => t.path.length > p.length && startsWith(t.path, p));
  const livePins = pins.flatMap((pin, slot) =>
    pin && (pin.group ? childrenOf(pin.path).length : findToken(pin.path)) ? [{ ...pin, slot }] : [],
  );
  const openGroup = (p: string[]) => <Level project={project} tokens={tokens} path={p} />;

  function pinActions(target: Pin) {
    const id = target.path.join(".");
    const pinnedSlot = pins.findIndex((p) => p?.path.join(".") === id && p.group === target.group);
    const setSlot = (slot: number, value: Pin | null) =>
      setPins(Array.from({ length: 9 }, (_, i) => (i === slot ? value : i === pinnedSlot ? null : (pins[i] ?? null))));
    return (
      <>
        <ActionPanel.Section title="Pinned">
          {livePins.map(({ path: p, group, slot }) => {
            const name = p.join(".");
            const token = findToken(p);
            return group || !token ? (
              <Action.Push
                key={slot}
                title={`Open ${name}`}
                icon={Icon.Folder}
                shortcut={openShortcut(slot)}
                target={openGroup(p)}
              />
            ) : (
              <Action.CopyToClipboard
                key={slot}
                title={`Copy ${name}`}
                content={token.value}
                shortcut={openShortcut(slot)}
              />
            );
          })}
        </ActionPanel.Section>
        <ActionPanel.Section title="Pin">
          {pinnedSlot >= 0 && (
            <Action title="Unpin" icon={Icon.PinDisabled} onAction={() => setSlot(pinnedSlot, null)} />
          )}
          {Array.from({ length: 9 }, (_, slot) => (
            <Action
              key={slot}
              title={`Pin to Slot ${slot + 1}${pins[slot] && slot !== pinnedSlot ? ` (replaces ${pins[slot]?.path.join(".")})` : ""}`}
              icon={Icon.Pin}
              shortcut={pinShortcut(slot)}
              onAction={() => setSlot(slot, target)}
            />
          ))}
        </ActionPanel.Section>
        <ActionPanel.Section>
          <Action.Push title="Manage Projects" icon={Icon.Gear} target={<ManageProjects />} />
        </ActionPanel.Section>
      </>
    );
  }

  const groupItem = (groupPath: string[], title: string, key = groupPath.join(".")) => {
    const children = childrenOf(groupPath);
    return (
      <Grid.Item
        key={key}
        title={title}
        subtitle={`${children.length} tokens`}
        content={groupPreview(children) ?? { source: Icon.Folder, tintColor: "#888" }}
        actions={
          <ActionPanel>
            <Action.Push title="Open Group" icon={Icon.ArrowRight} target={openGroup(groupPath)} />
            <Action.CopyToClipboard title="Copy Name" content={groupPath.join(".")} />
            {pinActions({ path: groupPath, group: true })}
          </ActionPanel>
        }
      />
    );
  };

  const tokenItem = (t: Token, title: string, key = t.path.join(".")) => (
    <Grid.Item
      key={key}
      title={title}
      subtitle={t.value}
      content={preview(t)}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Value" content={t.value} />
          <Action.CopyToClipboard title="Copy Name" content={t.path.join(".")} />
          {t.alias && <Action.CopyToClipboard title="Copy Alias" content={t.alias} />}
          <ActionPanel.Section title="Templates">
            {renderTemplates(templates, t).map((out, i) => (
              <Action.CopyToClipboard key={i} title={`Copy ${out}`} content={out} />
            ))}
          </ActionPanel.Section>
          {pinActions({ path: t.path, group: false })}
        </ActionPanel>
      }
    />
  );

  return (
    <Grid
      columns={5}
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={setSearch}
      searchBarPlaceholder="Search tokens by name, path, or value"
      navigationTitle={path.length ? path.join(".") : project.name}
      searchBarAccessory={accessory}
    >
      {path.length === 0 && !terms.length && (
        <Grid.Section title="Pinned">
          {livePins.map(({ path: p, group, slot }) => {
            const title = `${slot + 1} · ${p.join(".")}`;
            const token = findToken(p);
            return group || !token ? groupItem(p, title, `pin-${slot}`) : tokenItem(token, title, `pin-${slot}`);
          })}
        </Grid.Section>
      )}
      <Grid.Section title="Groups">{groups.map((g) => groupItem([...path, g], g))}</Grid.Section>
      <Grid.Section title={terms.length ? `${leaves.length} matches` : "Tokens"}>
        {leaves.map((t) =>
          tokenItem(t, terms.length ? t.path.slice(path.length).join(".") : t.path[t.path.length - 1]),
        )}
      </Grid.Section>
    </Grid>
  );
}
