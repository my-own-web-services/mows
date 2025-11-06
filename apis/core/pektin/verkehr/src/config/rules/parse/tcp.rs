use anyhow::bail;
use ipnet::IpNet;
use nom::branch::alt;
use nom::bytes::complete::{tag, tag_no_case, take_until1};
use nom::character::complete::multispace0;
use nom::combinator::{all_consuming, map, opt};
use nom::error::{ErrorKind, ParseError};
use nom::multi::{many0, separated_list1};
use nom::sequence::{delimited, preceded};
use nom::Err::Error;
use nom::IResult;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::str::FromStr;

#[derive(Debug, PartialEq)]
enum CustomTcpParseError<I> {
    InvalidRegex,
    InvalidIp,
    Nom(I, ErrorKind),
}

impl<I> ParseError<I> for CustomTcpParseError<I> {
    fn from_error_kind(input: I, kind: ErrorKind) -> Self {
        CustomTcpParseError::Nom(input, kind)
    }

    fn append(_: I, _: ErrorKind, other: Self) -> Self {
        other
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParsedTcpRoutingRule {
    pub len: usize,
    pub rule: TcpRoutingRule,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum TcpRoutingRule {
    Function(TcpRoutingFunction),
    NegatedRule(Box<TcpRoutingRule>),
    Or(Vec<TcpRoutingRule>),
    And(Vec<TcpRoutingRule>),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum TcpRoutingFunction {
    HostSNI {
        hosts: Vec<String>,
    },
    #[serde(with = "serde_regex")]
    HostSNIRegexp {
        hosts: Vec<Regex>,
    },
    ClientIP {
        ips: Vec<IpNet>,
    },
}

pub fn parse_tcp_routing_rule(input: &str) -> anyhow::Result<ParsedTcpRoutingRule> {
    let parsed = match all_consuming(rule)(input) {
        Ok((_, parsed)) => parsed,
        // TODO: more descriptive error message?
        Err(e) => {
            dbg!(&e);
            bail!("invalid rule: {e}")
        }
    };
    Ok(ParsedTcpRoutingRule {
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
see tcp://www.craftinginterpreters.com/parsing-expressions.html
*/

fn rule(input: &str) -> IResult<&str, TcpRoutingRule, CustomTcpParseError<&str>> {
    or(input)
}

fn or(input: &str) -> IResult<&str, TcpRoutingRule, CustomTcpParseError<&str>> {
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
        Ok((rest, TcpRoutingRule::Or(or_items)))
    }
}

fn and(input: &str) -> IResult<&str, TcpRoutingRule, CustomTcpParseError<&str>> {
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
        Ok((rest, TcpRoutingRule::And(or_items)))
    }
}

fn matcher(input: &str) -> IResult<&str, TcpRoutingRule, CustomTcpParseError<&str>> {
    let (rest, bang) = opt(tag("!"))(input)?;

    let left_paren = delimited(multispace0, tag("("), multispace0);
    let right_paren = delimited(multispace0, tag(")"), multispace0);
    let actual_function = map(
        alt((host_sni, host_sni_regexp, client_ip)),
        TcpRoutingRule::Function,
    );
    let (rest, parsed_matcher) =
        alt((actual_function, delimited(left_paren, rule, right_paren)))(rest)?;

    match bang {
        Some(_) => Ok((rest, TcpRoutingRule::NegatedRule(Box::new(parsed_matcher)))),
        None => Ok((rest, parsed_matcher)),
    }
}

fn host_sni(input: &str) -> IResult<&str, TcpRoutingFunction, CustomTcpParseError<&str>> {
    let (rest, hosts) = delimited(tag_no_case("HostSNI("), manystring1, tag(")"))(input)?;
    Ok((rest, TcpRoutingFunction::HostSNI { hosts }))
}

fn host_sni_regexp(input: &str) -> IResult<&str, TcpRoutingFunction, CustomTcpParseError<&str>> {
    let (rest, hosts) = delimited(tag_no_case("HostSNIRegexp("), manyregex1, tag(")"))(input)?;
    Ok((rest, TcpRoutingFunction::HostSNIRegexp { hosts }))
}

fn client_ip(input: &str) -> IResult<&str, TcpRoutingFunction, CustomTcpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    let manyip1 = separated_list1(sep, ip);
    let (rest, ips) = delimited(tag_no_case("ClientIP("), manyip1, tag(")"))(input)?;
    Ok((rest, TcpRoutingFunction::ClientIP { ips }))
}

fn manystring1(input: &str) -> IResult<&str, Vec<String>, CustomTcpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    separated_list1(sep, string)(input)
}

fn string(input: &str) -> IResult<&str, String, CustomTcpParseError<&str>> {
    delimited(tag("`"), take_until1("`"), tag("`"))(input)
        .map(|(rest, string)| (rest, string.to_string()))
}

fn regex(input: &str) -> IResult<&str, Regex, CustomTcpParseError<&str>> {
    let (rest, string) = string(input)?;
    let regex = Regex::new(&string).map_err(|_| Error(CustomTcpParseError::InvalidRegex))?;
    Ok((rest, regex))
}

fn manyregex1(input: &str) -> IResult<&str, Vec<Regex>, CustomTcpParseError<&str>> {
    let sep = delimited(multispace0, tag(","), multispace0);
    separated_list1(sep, regex)(input)
}

fn ip(input: &str) -> IResult<&str, IpNet, CustomTcpParseError<&str>> {
    let (rest, string) = string(input)?;
    let net = match IpNet::from_str(&string) {
        Ok(net) => net,
        Err(_) => {
            let ip: IpAddr = string
                .parse()
                .map_err(|_| Error(CustomTcpParseError::InvalidIp))?;
            let prefix_len = if ip.is_ipv4() { 32 } else { 128 };
            IpNet::new(ip, prefix_len).unwrap()
        }
    };
    Ok((rest, net))
}
