use std::collections::HashMap;

use filez_common::server::file::FilezFile;
use lazy_static::lazy_static;
use regex::Regex;
use serde_json::Value;

use crate::{
    metadata_types::{self, Clues},
    some_or_bail,
};

pub async fn get_clues(
    file: &FilezFile,
    exifdata: &Option<HashMap<String, Value>>,
) -> anyhow::Result<Option<Clues>> {
    let mime_prefix = some_or_bail!(file.mime_type.split('/').next(), "Invalid mime type");

    if mime_prefix == "video" {
        let tt_id = get_tt_id(&file.name);
        let clues = Clues::Video(metadata_types::VideoClues { tt_id });

        return Ok(Some(clues));
    }

    if mime_prefix == "audio" {
        let isrc = get_isrc(&file.name);
        let upc = get_upc(&file.name);
        let clues = Clues::Music(metadata_types::MusicClues { isrc, upc });

        return Ok(Some(clues));
    }

    Ok(None)
}

// example: /Imagine Dragons/Radioactive (Explicit)/01 - Radioactive - USUM71400693 - 602537744039.mp3

// USUM71400693 is the ISRC
//      US - Ländercode des Ursprungslandes des ISRC-Ausstellers; Beispiel DE für Deutschland (2 Stellen)
//      UM7 - Erstvergabeschlüssel, Betriebsnummer des ISRC-Ausstellers (von der Registrarstelle erteilt); (3 Stellen)
//      14 - Jahr der Erstvergabe (2 Stellen) 1940 bis 2039
//      00693 - Seriennummer (5 Stellen)

// all 2 digit iso country codes:
// AF|AX|AL|DZ|AS|AD|AO|AI|AQ|AG|AR|AM|AW|AU|AT|AZ|BS|BH|BD|BB|BY|BE|BZ|BJ|BM|BT|BO|BQ|BA|BW|BV|BR|IO|BN|BG|BF|BI|KH|CM|CA|CV|KY|CF|TD|CL|CN|CX|CC|CO|KM|CG|CD|CK|CR|CI|HR|CU|CW|CY|CZ|DK|DJ|DM|DO|EC|EG|SV|GQ|ER|EE|ET|FK|FO|FJ|FI|FR|GF|PF|TF|GA|GM|GE|DE|GH|GI|GR|GL|GD|GP|GU|GT|GG|GN|GW|GY|HT|HM|VA|HN|HK|HU|IS|IN|ID|IR|IQ|IE|IM|IL|IT|JM|JP|JE|JO|KZ|KE|KI|KP|KR|KW|KG|LA|LV|LB|LS|LR|LY|LI|LT|LU|MO|MK|MG|MW|MY|MV|ML|MT|MH|MQ|MR|MU|YT|MX|FM|MD|MC|MN|ME|MS|MA|MZ|MM|NA|NR|NP|NL|NC|NZ|NI|NE|NG|NU|NF|MP|NO|OM|PK|PW|PS|PA|PG|PY|PE|PH|PN|PL|PT|PR|QA|RE|RO|RU|RW|BL|SH|KN|LC|MF|PM|VC|WS|SM|ST|SA|SN|RS|SC|SL|SG|SX|SK|SI|SB|SO|ZA|GS|SS|ES|LK|SD|SR|SJ|SZ|SE|CH|SY|TW|TJ|TZ|TH|TL|TG|TK|TO|TT|TN|TR|TM|TC|TV|UG|UA|AE|GB|US|UM|UY|UZ|VU|VE|VN|VG|VI|WF|EH|YE|ZM|ZW

// regex: [^0-9A-Za-z]((AF|AX|AL|DZ|AS|AD|AO|AI|AQ|AG|AR|AM|AW|AU|AT|AZ|BS|BH|BD|BB|BY|BE|BZ|BJ|BM|BT|BO|BQ|BA|BW|BV|BR|IO|BN|BG|BF|BI|KH|CM|CA|CV|KY|CF|TD|CL|CN|CX|CC|CO|KM|CG|CD|CK|CR|CI|HR|CU|CW|CY|CZ|DK|DJ|DM|DO|EC|EG|SV|GQ|ER|EE|ET|FK|FO|FJ|FI|FR|GF|PF|TF|GA|GM|GE|DE|GH|GI|GR|GL|GD|GP|GU|GT|GG|GN|GW|GY|HT|HM|VA|HN|HK|HU|IS|IN|ID|IR|IQ|IE|IM|IL|IT|JM|JP|JE|JO|KZ|KE|KI|KP|KR|KW|KG|LA|LV|LB|LS|LR|LY|LI|LT|LU|MO|MK|MG|MW|MY|MV|ML|MT|MH|MQ|MR|MU|YT|MX|FM|MD|MC|MN|ME|MS|MA|MZ|MM|NA|NR|NP|NL|NC|NZ|NI|NE|NG|NU|NF|MP|NO|OM|PK|PW|PS|PA|PG|PY|PE|PH|PN|PL|PT|PR|QA|RE|RO|RU|RW|BL|SH|KN|LC|MF|PM|VC|WS|SM|ST|SA|SN|RS|SC|SL|SG|SX|SK|SI|SB|SO|ZA|GS|SS|ES|LK|SD|SR|SJ|SZ|SE|CH|SY|TW|TJ|TZ|TH|TL|TG|TK|TO|TT|TN|TR|TM|TC|TV|UG|UA|AE|GB|US|UM|UY|UZ|VU|VE|VN|VG|VI|WF|EH|YE|ZM|ZW)[A-Z0-9]{3}[0-9]{2}[0-9]{5})[^0-9A-Za-z]

fn get_isrc(string: &str) -> Option<String> {
    lazy_static! {
        static ref ISRC_RE: Regex = Regex::new("[^0-9A-Za-z]((AF|AX|AL|DZ|AS|AD|AO|AI|AQ|AG|AR|AM|AW|AU|AT|AZ|BS|BH|BD|BB|BY|BE|BZ|BJ|BM|BT|BO|BQ|BA|BW|BV|BR|IO|BN|BG|BF|BI|KH|CM|CA|CV|KY|CF|TD|CL|CN|CX|CC|CO|KM|CG|CD|CK|CR|CI|HR|CU|CW|CY|CZ|DK|DJ|DM|DO|EC|EG|SV|GQ|ER|EE|ET|FK|FO|FJ|FI|FR|GF|PF|TF|GA|GM|GE|DE|GH|GI|GR|GL|GD|GP|GU|GT|GG|GN|GW|GY|HT|HM|VA|HN|HK|HU|IS|IN|ID|IR|IQ|IE|IM|IL|IT|JM|JP|JE|JO|KZ|KE|KI|KP|KR|KW|KG|LA|LV|LB|LS|LR|LY|LI|LT|LU|MO|MK|MG|MW|MY|MV|ML|MT|MH|MQ|MR|MU|YT|MX|FM|MD|MC|MN|ME|MS|MA|MZ|MM|NA|NR|NP|NL|NC|NZ|NI|NE|NG|NU|NF|MP|NO|OM|PK|PW|PS|PA|PG|PY|PE|PH|PN|PL|PT|PR|QA|RE|RO|RU|RW|BL|SH|KN|LC|MF|PM|VC|WS|SM|ST|SA|SN|RS|SC|SL|SG|SX|SK|SI|SB|SO|ZA|GS|SS|ES|LK|SD|SR|SJ|SZ|SE|CH|SY|TW|TJ|TZ|TH|TL|TG|TK|TO|TT|TN|TR|TM|TC|TV|UG|UA|AE|GB|US|UM|UY|UZ|VU|VE|VN|VG|VI|WF|EH|YE|ZM|ZW)[A-Z0-9]{3}[0-9]{2}[0-9]{5})[^0-9A-Za-z]").unwrap();
    }
    match ISRC_RE.captures(string) {
        Some(caps) => caps.get(1).map(|m| m.as_str().to_string()),
        None => None,
    }
}

// 602537744039 is the UPC
// 6025 - GS1 Basisnummer
// 3774403 - Artikelnummer
// 9 - Prüfziffer

// regex in js: [^0-9]([0-9]{12})[^0-9]

// prüfziffer berechnung:
// 60253774403
// 6 0 2 5 3 7 7 4 4 0 3 nutznummer ohne prüfziffer
// 3 1 3 1 3 1 3 1 3 1 3 multiplikator maske von rechts nach links abwechselnd 3 und 1
// 18 0 6 5 9 7 21 4 12 0 9=91 summe der multiplikationen
// 100-91=9 ergänzung zum nächsten vielfachen von 10 -> 100 differenz ist die prüfziffer

fn get_upc(string: &str) -> Option<String> {
    lazy_static! {
        static ref UPC_RE: Regex = Regex::new("[^0-9]([0-9]{12})[^0-9]").unwrap();
    }
    match UPC_RE.captures(string) {
        Some(caps) => match caps.get(1) {
            Some(m) => match check_upc_checksum(m.as_str()) {
                true => Some(m.as_str().to_string()),
                false => None,
            },
            None => None,
        },
        None => None,
    }
}

fn check_upc_checksum(maybe_upc: &str) -> bool {
    let (use_number, checksum) = maybe_upc.split_at(maybe_upc.len() - 1);

    let checksum = match checksum.parse::<u32>() {
        Ok(d) => d,
        Err(_) => return false,
    };

    let mut sum = 0;
    let mut is_odd = true;
    for c in use_number.chars() {
        let digit = match c.to_digit(10) {
            Some(v) => v,
            None => return false,
        };

        if is_odd {
            sum += digit * 3;
        } else {
            sum += digit;
        }
        is_odd = !is_odd;
    }
    10 - (sum % 10) == checksum
}

fn get_tt_id(string: &str) -> Option<String> {
    if let Some(start_index) = string.find("tt") {
        let end_index =
            get_index_of_first_of_tokens(&string[start_index..], vec![".", "_", "-", " "]);
        match end_index {
            Some(ei) => {
                let maybe_id = string[start_index..start_index + ei]
                    .to_string()
                    .replace("tt", "");
                if maybe_id.parse::<i32>().is_ok() {
                    Some(maybe_id)
                } else {
                    None
                }
            }
            None => None,
        }
    } else {
        None
    }
}

fn get_index_of_first_of_tokens(string: &str, to_find: Vec<&str>) -> Option<usize> {
    let mut index = None;

    for token in to_find {
        if let Some(i) = string.find(token) {
            if index.is_none() || i < index.unwrap() {
                index = Some(i);
            }
        }
    }

    index
}
