#include "reset_button.h"
#include "fsl_port.h"

void InitResetButton() {
    PORT_SetPinConfig(RESET_BUTTON_PORT, RESET_BUTTON_PIN,
                      &(port_pin_config_t){.pullSelect=kPORT_PullUp, .mux=kPORT_MuxAsGpio});
    CLOCK_EnableClock(RESET_BUTTON_CLOCK);
}
