/* eslint-disable quotes */

export interface ForeignApis {
  gandi?: ForeignApiInfo;
  ovh?: ForeignApiInfo;
  powerdns?: ForeignApiInfo;
}
export interface ForeignApiInfo {
  storage?: ForeignApiInfo;
  secrets?: {};
}
