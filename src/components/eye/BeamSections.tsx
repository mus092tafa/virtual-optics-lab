import type { BeamSection, EyeView } from '../../physics/eye'
import { formatLength, formatNumber, fromMeters } from '../../physics/units'

interface Props {
  view: EyeView
  /** Wavelength the sections are drawn for, when the light on the chart is not of one wavelength. */
  note?: string
}

/** Side of one drawing, in its own units. */
const SIZE = 100
const HALF = SIZE / 2 - 6

/** The largest distance from the axis the light reaches in a cross-section. */
const reachOf = (section: BeamSection): number => (section.shape.kind === 'ellipse' ? section.shape.major : Math.max(0, ...section.shape.radii))

/**
 * The beam of one object point cut at several planes, seen facing the eye, all at one scale: an ellipse (or a line, or
 * a point) for paraxial light, the rings that bound the zones of the pupil for real rays.
 */
export function BeamSections({ view, note }: Props) {
  const reach = Math.max(...view.sections.map(reachOf))
  if (view.sections.length === 0 || !(reach > 0)) return <p className="hint">The beam is a point at the retina: the image is in focus.</p>
  const scale = HALF / reach

  return (
    <div className="beam-sections">
      <div className="beam-strip">
        {view.sections.map((section) => {
          const { shape } = section
          return (
            <figure key={section.distance} className={section.atRetina ? 'retina' : undefined}>
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Cross-section of the beam ${section.atRetina ? 'at the retina' : `${formatLength(Math.abs(section.offset), 'mm', 2)} ${section.offset < 0 ? 'in front of' : 'behind'} the retina`}`}>
                <line x1={SIZE / 2} x2={SIZE / 2} y1={2} y2={SIZE - 2} className="beam-axis" />
                <line y1={SIZE / 2} y2={SIZE / 2} x1={2} x2={SIZE - 2} className="beam-axis" />
                {shape.kind === 'ellipse' ? (
                  // Seen facing the eye, an angle runs counter-clockwise; on the page that is a negative rotation.
                  <ellipse cx={SIZE / 2} cy={SIZE / 2} rx={Math.max(shape.major * scale, 0.8)} ry={Math.max(shape.minor * scale, 0.8)} transform={`rotate(${(-shape.angle * 180) / Math.PI} ${SIZE / 2} ${SIZE / 2})`} className="beam-patch" />
                ) : (
                  <>
                    <circle cx={SIZE / 2} cy={SIZE / 2} r={Math.max(reachOf(section) * scale, 0.8)} className="beam-patch" />
                    {/* Every fourth zone boundary: where the rings crowd, the light is concentrated. */}
                    {shape.radii.filter((_, index) => index % 4 === 0 && index > 0).map((radius, index) => (
                      <circle key={index} cx={SIZE / 2} cy={SIZE / 2} r={radius * scale} className="beam-ring" />
                    ))}
                  </>
                )}
              </svg>
              <figcaption>{section.atRetina ? 'retina' : `${section.offset < 0 ? '−' : '+'}${formatNumber(fromMeters(Math.abs(section.offset), 'mm'), 2)} mm`}</figcaption>
            </figure>
          )
        })}
      </div>
      <p className="hint">
        Cross-sections of the light of one object point, seen facing the eye, at distances from the retina (− in front). Each box is {formatNumber(fromMeters((2 * SIZE * reach) / (2 * HALF), 'um'), 0)} µm wide.
        {note ? ` ${note}` : ''}
      </p>
    </div>
  )
}
