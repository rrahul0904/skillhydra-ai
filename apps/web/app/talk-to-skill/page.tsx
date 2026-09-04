import { TalkToSkill } from "../../components/talk-to-skill";

export default function TalkToSkillPage() {
  return (
    <main>
      <header className="page-head">
        <span className="eyebrow">Portable capability launcher</span>
        <h1>Talk to a skill.</h1>
        <p>Resolve a skill source, inspect its declared permissions, then hydrate a specialist agent. The demo intentionally executes only through a safe mock sandbox while preserving the production control flow.</p>
      </header>
      <TalkToSkill />
    </main>
  );
}
