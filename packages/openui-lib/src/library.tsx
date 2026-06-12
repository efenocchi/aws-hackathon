/**
 * OpenUI (sponsor) component library — the vocabulary seller agents use to
 * design their own deliverable views. The API generates `SYSTEM_PROMPT` for the
 * agent; the web app renders the agent's OpenUI Lang output with <Renderer>.
 */
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";

const Storyboard = defineComponent({
  name: "Storyboard",
  description:
    "The deliverable header: production concept and tagline for a finished promo video.",
  props: z.object({
    concept: z.string().describe("One-sentence production concept"),
    tagline: z.string().describe("The spot's tagline"),
  }),
  component: ({ props: { concept, tagline } }) => (
    <div className="ouiBoard">
      <div className="ouiTagline">“{tagline}”</div>
      <p className="ouiConcept">{concept}</p>
    </div>
  ),
});

const ShotList = defineComponent({
  name: "ShotList",
  description: "Grid of the shots that make up the spot, each with its keyframe image.",
  props: z.object({
    shots: z
      .array(
        z.object({
          title: z.string().describe("Short shot title"),
          keyframeUrl: z.string().describe("URL of the shot's keyframe image"),
          motion: z.string().describe("One-line camera/motion description"),
        }),
      )
      .describe("Shots in order"),
  }),
  component: ({ props: { shots } }) => (
    <div className="ouiShots">
      {shots.map((s, i) => (
        <figure key={i} className="ouiShot">
          <img src={s.keyframeUrl} alt={s.title} />
          <figcaption>
            <b>
              {i + 1}. {s.title}
            </b>
            <span>{s.motion}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  ),
});

const PromoVideo = defineComponent({
  name: "PromoVideo",
  description: "The finished video player.",
  props: z.object({
    url: z.string().describe("MP4 URL of the finished promo"),
  }),
  component: ({ props: { url } }) => <video className="ouiVideo" src={url} controls autoPlay loop />,
});

const shotSchema = z.object({
  title: z.string().describe("Short shot title"),
  keyframeUrl: z.string().describe("URL of the shot's keyframe image"),
  motion: z.string().describe("One-line camera/motion description"),
});

const Deliverable = defineComponent({
  name: "Deliverable",
  description:
    "Root layout for a finished promo-video deliverable: header (concept + tagline), the video player, then the shot grid.",
  props: z.object({
    concept: z.string().describe("One-sentence production concept"),
    tagline: z.string().describe("The spot's tagline"),
    videoUrl: z.string().describe("MP4 URL of the finished promo"),
    shots: z.array(shotSchema).describe("Shots in order"),
  }),
  component: ({ props: { concept, tagline, videoUrl, shots } }) => (
    <div>
      <div className="ouiBoard">
        <div className="ouiTagline">“{tagline}”</div>
        <p className="ouiConcept">{concept}</p>
      </div>
      <video className="ouiVideo" src={videoUrl} controls autoPlay loop />
      <div className="ouiShots">
        {shots.map((s, i) => (
          <figure key={i} className="ouiShot">
            <img src={s.keyframeUrl} alt={s.title} />
            <figcaption>
              <b>
                {i + 1}. {s.title}
              </b>
              <span>{s.motion}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  ),
});

export const deliverableLibrary = createLibrary({
  components: [Deliverable, Storyboard, ShotList, PromoVideo],
  root: "Deliverable",
});

/** System prompt for the seller agent to design its deliverable view. */
export const OPENUI_SYSTEM_PROMPT = deliverableLibrary.prompt({
  preamble:
    "You are the Video Producer agent presenting a finished promo video to the buyer. Given the production data (concept, tagline, shots with keyframe URLs, final video URL), design the deliverable view. Lead with the Storyboard, then the PromoVideo, then the ShotList. Use the exact URLs provided.",
});

export { landingLibrary, LANDING_SYSTEM_PROMPT } from "./landing";
