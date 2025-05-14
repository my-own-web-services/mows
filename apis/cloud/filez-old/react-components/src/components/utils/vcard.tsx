export interface VcardUser {
    birthday?: number;
    cellphone?: string;
    city?: string;
    company?: string;
    country?: string;
    department?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    state?: string;
    street?: string;
    title?: string;
    zip?: string;
}

export const parseVcards = (vcard: string) => {
    const singleCards = vcard.split("BEGIN:VCARD").slice(1);
    const users = [];
    for (const singleCard of singleCards) {
        users.push(parseVcard(singleCard));
    }
    return users;
};
export const parseVcard = (vcard: string) => {
    const lines = vcard.split(
        (() => {
            if (vcard.includes("\r\n")) return "\r\n";
            if (vcard.includes("\n")) return "\n";
            return "\r\n";
        })()
    );
    const vcardUser: VcardUser = {};
    for (const line of lines) {
        const [key, value] = line.split(":");
        if (value?.length === 0) continue;

        if (key === "N") {
            const [lastName, firstName, middleName] = value.split(";");
            vcardUser.firstName = firstName;
            vcardUser.lastName = lastName;
            vcardUser.middleName = middleName;
        } else if (key === "EMAIL") {
            vcardUser.email = value;
        } else if (key === "TEL;CELL") {
            vcardUser.cellphone = value;
        } else if (key === "ADR") {
            const [street, city, state, zip, country] = value.split(";");
            vcardUser.street = street;
            vcardUser.city = city;
            vcardUser.state = state;
            vcardUser.zip = zip;
            vcardUser.country = country;
        } else if (key === "ORG") {
            const [company, department] = value.split(";");
            vcardUser.company = company;
            vcardUser.department = department;
        } else if (key === "TITLE") {
            vcardUser.title = value;
        } else if (key === "BDAY") {
            vcardUser.birthday = new Date(value).getTime();
        }
    }
    return vcardUser;
};

export const displayVcardUser = (vcardUser: VcardUser) => {
    return (
        <div style={{ margin: "10px" }}>
            <div>
                {vcardUser.firstName} {vcardUser.middleName}{" "}
                {vcardUser.lastName}
            </div>
            <div>{vcardUser.email}</div>
            <div>{vcardUser.cellphone}</div>
        </div>
    );
};
