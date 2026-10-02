import type { PrivateReviewContext } from "./private-review";
import type { OliveModel } from "../renderers/obhis-v1/model";

/** Development-only adapter. It must never be imported by the public registry. */
export function oliveFromPrivateReview(context: PrivateReviewContext): OliveModel {
  const asset = (key: keyof PrivateReviewContext["assets"], alt: string) => ({src: context.assets[key], alt});
  return {
    privateReview: true, applyHref: null, facebookHref: "https://www.facebook.com/profile.php?id=100010370084416",
    theme: context.theme,
    text: {
      school_name: context.displayName, short_name: "Olive", motto: "Integrity & Service",
      intro: "Olive Blessed Crest Academy is a school with roots in Nyanya, Abuja, and a belief that learning and character grow together. We want children to ask questions, take pride in their progress, and learn to care for the people around them.",
      album_heading: "The people make the place.", album_intro: "A shared table. A familiar face. The excitement of cultural day. Get to know Olive through the everyday moments and celebrations that bring our school together.",
      album_day_label: "School day", album_culture_label: "Cultural day", integrity_label: "Integrity", service_label: "Service",
      values_heading: "Integrity. Service.", values_intro: "Learning shapes what a child knows. It should also help shape how they treat others.",
      integrity_copy: "Being honest about our work, keeping our word, and taking responsibility when we get something wrong. Integrity grows through the choices we make every day.",
      service_copy: "Noticing when someone needs help and choosing to act. Making room for a classmate, sharing what we know, and caring for the spaces we use together.",
      campus_heading: "Different places. The same Olive.", campus_abuja: "Abuja", campus_rugam: "Rugam",
      admissions_heading: "Come with your questions.", admissions_intro: "Choosing a school is personal. Start with the things that matter to your family.",
      visit_address: "Plot 18C3, Habiscus Street, Federal Housing Estate, Karu Roundabout, Nyanya, Abuja, FCT",
      application_notice: "Application links will be added shortly.", contact_intro: "Questions about visiting or applying? You can reach the school by phone or email.",
      phone: "+2348057755997", email: "obhischool@gmail.com", donations_intro: "Donation links and QR codes will be added here shortly.",
      caption_friends: "A smile between moments.", caption_table: "Around the classroom table.", caption_abuja: "Colour, with a little volume.", caption_rugam: "Some moments need a hand.",
    },
    assets: {
      school_logo: asset("school-logo", "School logo: Integrity and Service"),
      hero_cutout: asset("hero-cutout", "Imagined layered paper lettering and patterned cotton on a cyan surface."),
      you_hero: asset("you-hero", "Imagined layered paper lettering and patterned cotton with soft contact shadows."),
      classroom_moment: asset("classroom-moment", "Two pupils at a classroom desk in white and cyan tops with patterned uniform details."),
      school_friends: asset("school-friends", "Pupils in white shirts and patterned school ties, with one smiling towards the camera."),
      classroom_table: asset("classroom-table", "Children seated around colourful classroom tables in their white shirts and patterned ties."),
      cultural_day_abuja: asset("cultural-day-abuja", "Children wearing patterned cultural dress and coral-coloured beads, with their arms raised."),
      cultural_day_rugam: asset("cultural-day-rugam", "An adult in patterned dress holding a child wearing black and coral-coloured beads."),
      uniform_detail: asset("uniform-detail", "A close detail of the cyan, coral and gold circles printed on the school's uniform fabric."),
    },
  };
}
