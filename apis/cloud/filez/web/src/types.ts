export interface Event {
    readonly title: string;
    readonly imageUrl?: string;
    readonly imageAlt?: string;
    readonly description: string;
    readonly dateTimeStart: Date;
    readonly dateTimeEnd: Date;
    readonly location: Location;
    readonly ticketLink?: string;
    readonly genre: string;
    readonly ageRestriction?: string;
    readonly acts?: Act[];
}

export interface Act {
    readonly name?: string;
    readonly artists?: Artist[];
    readonly artistJoiner?: string;
    readonly time?: string;
}

export interface Artist {
    readonly name: string;
    readonly url?: string;
}

export interface Location {
    readonly name: string;
    readonly latitude: number;
    readonly longitude: number;
}
