use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;

use anyhow::bail;
use ipnet::IpNet;
use nom::branch::alt;
use schemars::JsonSchema;
use nom::bytes::complete::{tag, tag_no_case, take_until1};
use nom::character::complete::multispace0;
use nom::combinator::{all_consuming, map, opt, recognize};
use nom::error::{ErrorKind, ParseError};
use nom::multi::{many0, separated_list1};
use nom::sequence::{delimited, preceded, separated_pair};
use nom::Err::Error;
use nom::IResult;
use regex::Regex;
use serde::{Deserialize, Serialize};
extern crate serde_regex;

#[derive(Debug, PartialEq)]
enum CustomHttpParseError<I> {
    InvalidRegex,
    InvalidIp,
    DuplicateQuery,
    Nom(I, ErrorKind),
}

impl<I> ParseError<I> for CustomHttpParseError<I> {
    fn from_error_kind(input: I, kind: ErrorKind) -> Self {
        CustomHttpParseError::Nom(input, kind)
    }

    fn append(_: I, _: ErrorKind, other: Self) -> Self {
        other
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct ParsedHttpRoutingRule {
    pub len: usize,
    pub rule: HttpRoutingRule,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub enum HttpRoutingRule {
    Function(HttpRoutingFunction),
    NegatedRule(Box<HttpRoutingRule>),
    Or(Vec<HttpRoutingRule>),
    And(Vec<HttpRoutingRule>),
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub enum HttpRoutingFunction {
    Headers {
        key: String,
        value: String,
    },

    HeadersRegexp {
        key: String,
        #[serde(with = "serde_regex")]
        #[schemars(with = "String")]
        value: Regex,
    },
    Host {
        hosts: Vec<String>,
    },
    HostHeader {
        hosts: Vec<String>,
    },

    HostRegexp {
        #[serde(with = "serde_regex")]
        #[schemars(with = "Vec<String>")]
        hosts: Vec<Regex>,
    },
    Method {
        methods: Vec<HttpMethod>,
    },

    Path {
        #[serde(with = "serde_regex")]
        #[schemars(with = "Vec<String>")]
        paths: Vec<Regex>,
    },

    PathPrefix {
        #[serde(with = "serde_regex")]
        #[schemars(with = "Vec<String>")]
        paths: Vec<Regex>,
    },
    Query {
        kv_pairs: HashMap<String, String>,
    },
    ClientIP {
        ips: Vec<IpNet>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
}

impl PartialEq<hyper::Method> for HttpMethod {
    fn eq(&self, other: &hyper::Method) -> bool {
        match self {
            HttpMethod::Get => other == hyper::Method::GET,
            HttpMethod::Post => other == hyper::Method::POST,
            HttpMethod::Put => other == hyper::Method::PUT,
            HttpMethod::Delete => other == hyper::Method::DELETE,
            HttpMethod::Patch => other == hyper::Method::PATCH,
            HttpMethod::Head => other == hyper::Method::HEAD,
        }
    }
}

pub fn parse_http_routing_rule(input: &str) -> anyhow::Result<ParsedHttpRoutingRule> {
    let parsed = match all_consuming(rule)(input) {
        Ok((_, parsed)) => parsed,
        // TODO: more descriptive error message?
        Err(e) => {
            dbg!(&e);
            bail!("invalid rule: {e}")
        }
    };
    Ok(ParsedHttpRoutingRule {
        len: input.len(),
        rule: parsed,
    })
}

/*
we parse the following grammar:
    rule     -> or ;
    or       -> and ( "||" and )* ;
    and      -> matcher ( "&&" matcher )* ;
    matcher  -> "!"? ( headers | headersRegexp | ... | "(" rule ")" ) ;
see http://www.craftinginterpreters.com/parsing-expressions.html
*/

fn rule(input: &str) -> IResult<&str, HttpRoutingRule, CustomHttpParseError<&str>> {
    or(input)
}

fn or(input: &str) -> IResult<&str, HttpRoutingRule, CustomHttpParseError<&str>> {
    let (rest, parsed_and) = and(input)?;

    let pre = delimited(multispace0, tag("||"), multispace0);
    let righthand_item = preceded(pre, and);
    let (rest, mut righthand) = many0(righthand_item)(rest)?;

    if righthand.is_empty() {
        Ok((rest, parsed_and))
    } else {
        let mut or_items = Vec::with_capacity(righthand.len() + 1);
        or_items.push(parsed_and);
        or_items.append(&mut righthand);
        Ok((rest, HttpRoutingRule::Or(or_items)))
    }
}

fn and(input: &str) -> IResult<&str, HttpRoutingRule, CustomHttpParseError<&str>> {
    let (rest, parsed_and) = matcher(input)?;

    let pre = delimited(multispace0, tag("&&"), multispace0);
    let righthand_item = preceded(pre, matcher);
    let (rest, mut righthand) = many0(righthand_item)(rest)?;

    if righthand.is_empty() {
        Ok((rest, parsed_and))
    } else {
        let mut or_items = Vec::with_capacity(righthand.len() + 1);
        or_items.push(parsed_and);
        or_items.append(&mut righthand);
        Ok((rest, HttpRoutingRule::And(or_items)))
    }
}

fn matcher(input: &str) -> IResult<&str, HttpRoutingRule, CustomHttpParseError<&str>> {
    let (rest, bang) = opt(tag("!"))(input)?;

    let left_paren = delimited(multispace0, tag("("), multispace0);
    let right_paren = delimited(multispace0, tag(")"), multispace0);
    let actual_function = map(
        alt((
            headers,
            headers_regexp,
            host,
            host_header,
            host_regexp,
            method,
            path,
            path_prefix,
            query,
            client_ip,
        )),
        HttpRoutingRule::Function,
    );
    let (rest, parsed_matcher) =
        alt((actual_function, delimited(left_paren, rule, right_paren)))(rest)?;

    match bang {
        Some(_) => Ok((rest, HttpRoutingRule::NegatedRule(Box::new(parsed_matcher)))),
        None => Ok((rest, parsed_matcher)),
    }
}

fn headers(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let kv = separated_pair(string, sep, string);
    let (rest, (key, value)) = delimited(tag_no_case("Headers("), kv, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::Headers { key, value }))
}

fn headers_regexp(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let kv = separated_pair(string, sep, regex);
    let (rest, (key, value)) = delimited(tag_no_case("Headers("), kv, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::HeadersRegexp { key, value }))
}

fn host(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let (rest, hosts) = delimited(tag_no_case("Host("), manystring1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::Host { hosts }))
}

fn host_header(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let (rest, hosts) = delimited(tag_no_case("HostHeader("), manystring1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::HostHeader { hosts }))
}

fn host_regexp(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let (rest, hosts) = delimited(tag_no_case("HostRegexp("), manyregex1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::HostRegexp { hosts }))
}

fn method(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let methods = separated_list1(sep, alt((get, post, put, delete, patch, head)));
    let (rest, methods) = delimited(tag_no_case("Method("), methods, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::Method { methods }))
}

fn path(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let (rest, paths) = delimited(tag_no_case("Path("), manyregex1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::Path { paths }))
}

fn path_prefix(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let (rest, paths) = delimited(tag_no_case("PathPrefix("), manyregex1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::PathPrefix { paths }))
}

fn query(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let kv = separated_list1(sep, key_value);
    let (rest, key_value_pairs) = delimited(tag_no_case("Query("), kv, tag(")"))(input)?;
    let mut kv_pairs = HashMap::new();
    for (key, value) in key_value_pairs.into_iter() {
        if kv_pairs.insert(key, value).is_some() {
            return Err(Error(CustomHttpParseError::DuplicateQuery));
        }
    }

    Ok((rest, HttpRoutingFunction::Query { kv_pairs }))
}

fn client_ip(input: &str) -> IResult<&str, HttpRoutingFunction, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let manyip1 = separated_list1(sep, ip);
    let (rest, ips) = delimited(tag_no_case("ClientIP("), manyip1, tag(")"))(input)?;
    Ok((rest, HttpRoutingFunction::ClientIP { ips }))
}

fn get(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("GET"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Get))
}

fn post(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("POST"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Post))
}

fn put(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("PUT"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Put))
}

fn delete(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("DELETE"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Delete))
}

fn patch(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("PATCH"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Patch))
}

fn head(input: &str) -> IResult<&str, HttpMethod, CustomHttpParseError<&str>> {
    let (rest, _) = recognize(delimited(tag("`"), tag_no_case("HEAD"), tag("`")))(input)?;
    Ok((rest, HttpMethod::Head))
}

fn key_value(input: &str) -> IResult<&str, (String, String), CustomHttpParseError<&str>> {
    separated_pair(string, tag("="), string)(input)
}

fn manystring1(input: &str) -> IResult<&str, Vec<String>, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    separated_list1(sep, string)(input)
}

fn string(input: &str) -> IResult<&str, String, CustomHttpParseError<&str>> {
    delimited(tag("`"), take_until1("`"), tag("`"))(input)
        .map(|(rest, string)| (rest, string.to_string()))
}

fn regex(input: &str) -> IResult<&str, Regex, CustomHttpParseError<&str>> {
    let (rest, string) = string(input)?;
    let regex = Regex::new(&string).map_err(|_| Error(CustomHttpParseError::InvalidRegex))?;
    Ok((rest, regex))
}

fn manyregex1(input: &str) -> IResult<&str, Vec<Regex>, CustomHttpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    separated_list1(sep, regex)(input)
}

fn ip(input: &str) -> IResult<&str, IpNet, CustomHttpParseError<&str>> {
    let (rest, string) = string(input)?;
    let net = match IpNet::from_str(&string) {
        Ok(net) => net,
        Err(_) => {
            let ip: IpAddr = string
                .parse()
                .map_err(|_| Error(CustomHttpParseError::InvalidIp))?;
            let prefix_len = if ip.is_ipv4() { 32 } else { 128 };
            IpNet::new(ip, prefix_len).unwrap()
        }
    };
    Ok((rest, net))
}
