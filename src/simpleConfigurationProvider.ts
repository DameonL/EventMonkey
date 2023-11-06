import { isDynamicConfiguration } from "./Configuration";
import { EventMonkeyConfiguration } from "./EventMonkey";
import { ConfigurationProvider } from "./EventMonkeyConfiguration";

export default function simpleConfigurationProvider(defaultConfiguration: EventMonkeyConfiguration): ConfigurationProvider {
  let configuration: EventMonkeyConfiguration = defaultConfiguration;

  const provider: ConfigurationProvider = {
    get: async () => {
      return configuration;
    },
    set: async (guild, value) => {
      if (isDynamicConfiguration(value)) {
        let newConfiguration = await value.get(guild);
        if (!newConfiguration) {
          throw new Error(`No configuration found for guild ${guild}`);
        }

        configuration = newConfiguration;
      } else {
        configuration = value;
      }
    },
  };

  return provider;
}
