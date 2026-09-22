import React from "react";
import { PrefetchPageLinks } from "react-router";
import { RepoConnector } from "#/components/features/home/repo-connector";
import { TaskSuggestions } from "#/components/features/home/tasks/task-suggestions";
import { GitRepository } from "#/types/git";
import { HomeGreeting } from "#/components/features/home/home-greeting";
import { HomeComposer } from "#/components/features/home/home-composer";
import { RecentConversations } from "#/components/features/home/recent-conversations/recent-conversations";
import { useJenticSurfaces } from "#/hooks/use-jentic-surfaces";

<PrefetchPageLinks page="/conversations/:conversationId" />;

/**
 * Greeting, composer, recents — and nothing that is not configured. The repo
 * cards and suggested repo tasks need a git provider; without one they were the
 * whole screen on a phone and pushed the only usable control below the fold.
 */
function HomeScreen() {
  const { git } = useJenticSurfaces();
  const [selectedRepo, setSelectedRepo] = React.useState<GitRepository | null>(
    null,
  );

  return (
    <div
      data-testid="home-screen"
      className="h-full overflow-y-auto custom-scrollbar-always bg-transparent rounded-xl flex flex-col items-center px-4 pt-8 pb-6 lg:px-[42px] lg:pt-[42px]"
    >
      <div className="w-full flex flex-col gap-6 lg:max-w-[703px]">
        <HomeGreeting />
        <HomeComposer />

        {git && (
          <div
            className="flex flex-col gap-5 md:flex-row"
            data-testid="home-screen-new-conversation-section"
          >
            <RepoConnector onRepoSelection={(repo) => setSelectedRepo(repo)} />
            <TaskSuggestions filterFor={selectedRepo} />
          </div>
        )}

        <div data-testid="home-screen-recent-conversations-section">
          <RecentConversations />
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;
