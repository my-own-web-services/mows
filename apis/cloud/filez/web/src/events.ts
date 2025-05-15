import { Event } from "./types";

export const events: Event[] = [
    {
        title: "genesis",
        imageUrl: "/assets/images/genesis.jpg",
        imageAlt: "A glowing polygon looking like the explosion of a star",
        dateTimeStart: new Date("2025-04-25T23:00:00+02:00"),
        dateTimeEnd: new Date("2025-04-26T07:00:00+02:00"),
        location: {
            name: "City Club Augsburg",
            latitude: 48.365419,
            longitude: 10.895053
        },
        description: `A new impulse emerges.
Impedanz enters the floor with a premiere designed to resonate deep. Expect raw grooves, hypnotic rhythms and bodies in sync from open to close.
Driven by detail, shaped by sound and grounded in awareness – this is only the beginning.`,
        ticketLink: "",
        ageRestriction: "18+",
        genre: "Hypnotic, Minimal, Hardgroove 135-155BPM",
        acts: [
            {
                artists: [
                    {
                        name: "Tyrellativ",
                        url: "https://www.instagram.com/tyrellativ/"
                    },
                    {
                        name: "Artifex",
                        url: "https://www.instagram.com/artifex.wav/"
                    }
                ],
                artistJoiner: "b2b"
            },
            {
                artists: [
                    {
                        name: "TONSAMMLER",
                        url: "https://www.instagram.com/ton.sammler/"
                    },
                    {
                        name: "Animar"
                    }
                ],
                artistJoiner: "b2b"
            },
            {
                artists: [
                    {
                        name: "Fio_licioud"
                    },
                    {
                        name: "balanced crohn",
                        url: "https://www.instagram.com/pepe_8_6_1/"
                    }
                ],
                artistJoiner: "b2b"
            },
            {
                artists: [
                    {
                        name: "kardioversion",
                        url: "https://www.instagram.com/kardioversion.music/"
                    },
                    {
                        name: "DJCANDYFLIP",
                        url: "https://www.instagram.com/dj.candyflip/"
                    }
                ],
                artistJoiner: "b2b"
            }
        ]
    }
] as const;
