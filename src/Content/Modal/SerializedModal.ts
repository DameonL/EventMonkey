import { ActionRowBuilder, ModalActionRowComponentBuilder, TextInputBuilder, TextInputComponent, TextInputStyle } from "discord.js";

export interface ModalSerializationConfig {
  labels?: {
    [fieldName: string]: string;
  };
  styles?: {
    [fieldName: string]: TextInputStyle;
  };
  formatters?: {
    [fieldName: string]: (fieldValue: any) => string;
  };
}



export interface ModalDeserializationConfig {
  validators?: {
    [fieldName: string]:
      | ((fieldValue: string) => string | undefined)
      | undefined;
  };
  customDeserializers?: {
    [fieldName: string]: ((fieldValue: string) => any) | undefined;
  };
}

export function serializeToModal(
  prefix: string,
  target: any,
  config?: ModalSerializationConfig
): ActionRowBuilder<TextInputBuilder>[] {
  const output: ActionRowBuilder<TextInputBuilder>[] = [];

  for (const fieldName in target) {
    let label = config?.labels?.[fieldName] ?? fieldName;
    let style = config?.styles?.[fieldName] ?? TextInputStyle.Short;
    let value = target[fieldName];
    if (config?.formatters?.[fieldName])
      value = config.formatters[fieldName](target[fieldName]);

    value = value.toString();

    output.push(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setLabel(label)
          .setCustomId(`${prefix}${fieldName}`)
          .setStyle(style)
          .setValue(value)
      )
    );
  }

  return output;
}

export function deserializeModal<T>(
  fields: IterableIterator<[string, TextInputComponent]>,
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
          const validationResponse = config.validators[fieldName]?.(
            fieldComponent.value
          );
          if (validationResponse) {
            throw new Error(validationResponse);
          }
        }

        if (config?.customDeserializers?.[fullFieldName]) {
          currentObject[fieldName] = config.customDeserializers?.[
            fullFieldName
          ]?.(fieldComponent.value);
        } else {
          currentObject[fieldName] = fieldComponent.value.trim();
        }
      }
    }
  }

  return output as T;
}

