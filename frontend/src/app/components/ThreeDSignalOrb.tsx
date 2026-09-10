'use client';

interface ThreeDSignalOrbProps {
  modelReady?: boolean;
  providerConfigured?: boolean;
}

export default function ThreeDSignalOrb({
  modelReady = false,
  providerConfigured = false,
}: ThreeDSignalOrbProps) {
  return (
    <div className="signal-stage" aria-label="RailTrackr model and provider status visualization">
      <div className="signal-stage__halo signal-stage__halo--one" />
      <div className="signal-stage__halo signal-stage__halo--two" />
      <div className="signal-orb" aria-hidden="true">
        <div className="signal-orb__latitude" />
        <div className="signal-orb__longitude" />
        <div className="signal-orb__core">
          <span className="signal-orb__core-mark">RP</span>
          <span className="signal-orb__core-label">LIVE INTELLIGENCE</span>
        </div>
        <span className="signal-orb__node signal-orb__node--a" />
        <span className="signal-orb__node signal-orb__node--b" />
        <span className="signal-orb__node signal-orb__node--c" />
      </div>

      <div className="signal-readout signal-readout--top">
        <span className="signal-readout__label">MODEL SURFACE</span>
        <span className={`signal-readout__value ${modelReady ? 'is-ready' : ''}`}>
          {modelReady ? 'READY' : 'WAITING'}
        </span>
      </div>
      <div className="signal-readout signal-readout--bottom">
        <span className="signal-readout__label">LIVE PROVIDER</span>
        <span className={`signal-readout__value ${providerConfigured ? 'is-ready' : ''}`}>
          {providerConfigured ? 'CONNECTED' : 'CONFIGURE KEY'}
        </span>
      </div>
      <div className="signal-axis signal-axis--x" />
      <div className="signal-axis signal-axis--y" />
    </div>
  );
}
