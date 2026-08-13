"use client"

/**
 * What the model read, and — the part that matters — which inputs it did not have.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { labelFor, type PredictionMethodology, type Provenance } from "./fomc-types"

export function PredictionMethodologySection({
  predictionMethodology,
  provenance,
  unavailableInputs,
}: {
  predictionMethodology: PredictionMethodology | null
  provenance: Provenance | null
  unavailableInputs: string[]
}) {
  return (
    <>
        {predictionMethodology && (
          <Card className="shadow-sm border-2 border-blue-200 bg-blue-50">
            <CardHeader className="bg-blue-100 border-b border-blue-200">
              <CardTitle className="text-lg font-bold text-gray-900">Prediction Methodology</CardTitle>
              <CardDescription className="text-gray-700">
                Transparent formula showing how we calculate predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Description:</p>
                  <p className="text-sm text-gray-700">{predictionMethodology.description}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Formula:</p>
                  <p className="text-sm font-mono bg-white p-3 rounded border border-blue-200 text-gray-900">
                    {predictionMethodology.formula}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Score Contributions:</p>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Inflation:</span>{" "}
                      {predictionMethodology.scoreContributions.inflation}
                    </div>
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Employment:</span>{" "}
                      {predictionMethodology.scoreContributions.employment}
                    </div>
                    <div className="text-sm bg-white p-2 rounded border border-blue-200">
                      <span className="font-semibold text-gray-900">Growth:</span>{" "}
                      {predictionMethodology.scoreContributions.growth}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{predictionMethodology.scoreContributions.note}</p>
                </div>

                {predictionMethodology.methodology && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <p>{predictionMethodology.methodology}</p>
                    {predictionMethodology.comparison && <p className="mt-2">{predictionMethodology.comparison}</p>}
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Scoring Factors:</p>
                  <ul className="space-y-1">
                    {predictionMethodology.factors.map((factor, index) => (
                      <li key={index} className="text-xs text-gray-700 bg-white p-2 rounded border border-blue-200">
                        • {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What the model actually read. Unavailable inputs are listed
                    rather than quietly replaced, so the weights above can be
                    checked against the data that existed. */}
                {provenance && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-2">Inputs Used:</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {Object.entries(provenance.inputs).map(([key, info]) => (
                        <div
                          key={key}
                          className="text-xs bg-white p-2 rounded border border-blue-200 flex items-center justify-between gap-2"
                        >
                          <span className="text-gray-900">{labelFor(key)}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              info.tier === "live" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {info.tier === "live" ? info.source : "unavailable"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {unavailableInputs.length > 0 && (
                      <p className="text-xs text-gray-700 mt-2">
                        Excluded from the model: {unavailableInputs.map(labelFor).join(", ")}. Missing inputs are never
                        replaced with representative values.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

    </>
  )
}
