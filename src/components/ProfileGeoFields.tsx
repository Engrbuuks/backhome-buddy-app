"use client";
import React, { useState } from "react";
import { StateLgaSelect, LgaMultiSelect } from "@/components/GeoSelects";

/** Self-contained state/LGA + coverage block for the buddy profile form.
 *  Uncontrolled-friendly: it manages its own state and submits via the named
 *  inputs the GeoSelects render, so it drops straight into a plain <form>. */
export default function ProfileGeoFields({ state: initState, lga: initLga, coverage }: {
  state?: string; lga?: string; coverage?: string[];
}) {
  const [state, setState] = useState(initState || "");
  const [lga, setLga] = useState(initLga || "");
  // Existing coverage may be old comma text or new "LGA, State" tags — keep as-is.
  const [cover, setCover] = useState<string[]>(coverage || []);

  return (
    <div className="space-y-4">
      <StateLgaSelect state={state} lga={lga} onStateChange={setState} onLgaChange={setLga} />
      <LgaMultiSelect value={cover} onChange={setCover} label="Coverage areas (select all you cover)" />
    </div>
  );
}
