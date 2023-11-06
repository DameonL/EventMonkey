import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  TextInputBuilder,
  TextInputComponent,
  TextInputStyle,
} from "discord.js";
import { EventMonkeyEvent } from "../../EventMonkeyEvent";

export interface ModalSerializationConfig {
  labels?: {
    [fieldName: string]: string;
  };
  styles?: {
    [fieldName: string]: TextInputStyle;
  };
  formatters?: {
    [fieldName: string]: (fieldValue: any, guildId: string) => string | Promise<string>;
  };
}

export interface ModalDeserializationConfig {
  validators?: {
    [fieldName: string]: ((fieldValue: string) => string | undefined) | undefined;
  };
  customDeserializers?: {
    [fieldName: string]: ((fieldValue: string, guildId: string) => any | Promise<any>) | undefined;
  };
}

export async function serializeToModal(
  prefix: string,
  target: EventMonkeyEvent,
  guildId: string,
  config?: ModalSerializationConfig
): Promise<ActionRowBuilder<TextInputBuilder>[]> {
  const output: ActionRowBuilder<TextInputBuilder>[] = [];

  for (const fieldName in target) {
    let label = config?.labels?.[fieldName] ?? fieldName;
    let style = config?.styles?.[fieldName] ?? TextInputStyle.Short;
    let value = (target as any)[fieldName];
    if (config?.formatters?.[fieldName])
      value = await config.formatters[fieldName]((target as any)[fieldName], guildId);

    value = value.toString();

    output.push(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder().setLabel(label).setCustomId(`${prefix}${fieldName}`).setStyle(style).setValue(value)
      )
    );
  }

  return output;
}

export async function deserializeModal<T>(
  fields: IterableIterator<[string, TextInputComponent]>,
  guildId: string,
  deserializeTarget?: any,
  config?: ModalDeserializationConfig
) {
  const fieldPrefix = `${deserializeTarget.id}_`;
  const output: any = deserializeTarget ?? {};
  for (let [fullFieldName, fieldComponent] of fields) {
    fullFieldName = fullFieldName.replace(fieldPrefix, "");
    const splitFieldName = fullFieldName.split(".");
    let currentObject = output;
    for (let i = 0; i < splitFieldName.length; i++) {
      const fieldName = splitFieldName[i];
      if (i < splitFieldName.length - 1) {
        if (!currentObject[fieldName]) {
          const newObject = {};
          currentObject[fieldName] = newObject;
          currentObject = newObject;
        } else {
          currentObject = currentObject[fieldName];
        }
      } else {
        if (config?.validators?.[fullFieldName]) {
          const validationResponse = config.validators[fieldName]?.(fieldComponent.value);
          if (validationResponse) {
            throw new Error(validationResponse);
          }
        }

        if (config?.customDeserializers?.[fullFieldName]) {
          currentObject[fieldName] = await config.customDeserializers?.[fullFieldName]?.(fieldComponent.value, guildId);
        } else {
          currentObject[fieldName] = fieldComponent.value.trim();
        }
      }
    }
  }

  return output as T;
}
