import { FilterRule } from "@firstdorsal/filez-client/dist/js/apiTypes/FilterRule";
import { PureComponent } from "react";
import { Input, InputPicker } from "rsuite";
import FileGroup from "./FileGroup";
import update from "immutability-helper";
import { FilterRuleType } from "@firstdorsal/filez-client/dist/js/apiTypes/FilterRuleType";

interface DynamicGroupRulesProps {
    readonly rule: FilterRule;
    readonly updateRule: InstanceType<typeof FileGroup>["updateRule"];
}

interface DynamicGroupRulesState {}

const filterRuleTypes = ["MatchRegex", "NotMatchRegex"];

export default class DynamicGroupRules extends PureComponent<
    DynamicGroupRulesProps,
    DynamicGroupRulesState
> {
    constructor(props: DynamicGroupRulesProps) {
        super(props);
        this.state = {};
    }

    ruleFieldChange = (value: string) => {
        this.props.updateRule(
            update(this.props.rule, {
                field: { $set: value }
            })
        );
    };

    ruleTypeChange = (value: string) => {
        this.props.updateRule(
            update(this.props.rule, {
                rule_type: { $set: value as FilterRuleType }
            })
        );
    };

    ruleValueChange = (value: string) => {
        this.props.updateRule(
            update(this.props.rule, {
                value: { $set: value }
            })
        );
    };

    render = () => {
        return (
            <div className="DynamicGroupRules">
                <div>
                    <label>Field</label>
                    <Input
                        placeholder="Field"
                        value={this.props.rule.field}
                        onChange={this.ruleFieldChange}
                    />
                </div>
                <div>
                    <label>Rule Type</label>
                    <br />
                    <InputPicker
                        data={filterRuleTypes.map(v => {
                            return {
                                label: v,
                                value: v
                            };
                        })}
                        cleanable={false}
                        value={this.props.rule.rule_type}
                        onChange={this.ruleTypeChange}
                    />
                </div>
                <div>
                    <label>Value</label>
                    <Input
                        placeholder="Value"
                        value={this.props.rule.value}
                        onChange={this.ruleValueChange}
                    />
                </div>
            </div>
        );
    };
}
