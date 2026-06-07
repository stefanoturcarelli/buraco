import { useState } from "react";

export function Lobby({
  onCreate,
  onJoin,
  hotseat,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
  hotseat: boolean;
}) {
  const [code, setCode] = useState("");
  return (
    <div>
      <p>
        {hotseat
          ? "Single-device (hotseat) mode: create a game and pass the phone back and forth."
          : "Create a game and share the code/link with the other player."}
      </p>
      <div style={{ marginBottom: 16 }}>
        <button onClick={onCreate} style={{ fontSize: 16, padding: "8px 16px" }}>
          Create new game
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onJoin(code.trim());
        }}
      >
        <label>
          Join by code:{" "}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. ab12cd"
            style={{ fontSize: 16, padding: 6 }}
          />
        </label>{" "}
        <button type="submit" style={{ fontSize: 16, padding: "8px 16px" }}>
          Join
        </button>
      </form>
    </div>
  );
}
