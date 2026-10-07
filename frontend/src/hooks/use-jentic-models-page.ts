import { useQuery } from "@tanstack/react-query";

export const JENTIC_MODELS_PATH = "/jentic_x/models/";

/**
 * jentic-x: the box serves its own model, and its status server, mounted at /jentic_x/ on this
 * origin, has a Models page (download from Hugging Face, profiles, switching). Anywhere else
 * there is no such server. The app answers unknown paths with its own index page, so a 200 is
 * not enough: the health document has to say it is the /jentic_x mount.
 */
export function useJenticModelsPage(): boolean {
  const { data } = useQuery({
    queryKey: ["jentic-models-page"],
    queryFn: async () => {
      try {
        const r = await fetch("/jentic_x/api/health", {
          credentials: "same-origin",
        });
        if (!r.ok) return false;
        const d = await r.json();
        return d?.ok === true && d?.mount === "/jentic_x";
      } catch {
        return false;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}
