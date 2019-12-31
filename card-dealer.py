#!/usr/bin/env python3
# Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
# 
# You may not use this file except in compliance with the terms and conditions 
# set forth in the accompanying LICENSE.TXT file.
#
# THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
# RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
# THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

import os
import sys
import time
import logging
import json
import random
import threading

from enum import Enum
from agt import AlexaGadget

from ev3dev2.led import Leds
from ev3dev2.sound import Sound
from ev3dev2.motor import OUTPUT_A, OUTPUT_B, OUTPUT_C, OUTPUT_D, MoveTank, SpeedPercent, MediumMotor, LargeMotor

# Set the logging level to INFO to see messages from AlexaGadget
logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(message)s')
logging.getLogger().addHandler(logging.StreamHandler(sys.stderr))
logger = logging.getLogger(__name__)

class GameCommand(Enum):
    """
    The list of preset commands and their invocation variation.
    These variations correspond to the skill slot values.
    """
    BLACKJACK_HIT = ['hit']
    UNO_DEAL_ONCE = ['deal once']
    UNO_DEAL_TWICE = ['deal twice']

class GameType(Enum):
    """
    The list of directional commands and their variations.
    These variations correspond to the skill slot values.
    """
    BLACKJACK = ['blackjack']
    UNO = ['uno']
    SHUFFLE_CARDS = ['shuffle-cards']

class MindstormsGadget(AlexaGadget):
    """
    A Mindstorms gadget that performs movement based on voice commands.
    Two types of commands are supported, directional movement and preset.
    """

    def __init__(self):
        """
        Performs Alexa Gadget initialization routines and ev3dev resource allocation.
        """
        super().__init__()

        # Gadget state
        self.patrol_mode = False

        # Ev3dev initialization
        self.leds = Leds()
        self.sound = Sound()

        self.turnMotor = LargeMotor(OUTPUT_B)
        self.cardsMotor = LargeMotor(OUTPUT_D)

        # Start threads
        # threading.Thread(target=self._patrol_thread, daemon=True).start()

    def on_connected(self, device_addr):
        """
        Gadget connected to the paired Echo device.
        :param device_addr: the address of the device we connected to
        """
        self.leds.set_color("LEFT", "GREEN")
        self.leds.set_color("RIGHT", "GREEN")
        logger.info("{} connected to Echo device".format(self.friendly_name))

    def on_disconnected(self, device_addr):
        """
        Gadget disconnected from the paired Echo device.
        :param device_addr: the address of the device we disconnected from
        """
        self.leds.set_color("LEFT", "BLACK")
        self.leds.set_color("RIGHT", "BLACK")
        logger.info("{} disconnected from Echo device".format(self.friendly_name))

    def on_custom_mindstorms_gadget_control(self, directive):
        """
        Handles the Custom.Mindstorms.Gadget control directive.
        :param directive: the custom directive with the matching namespace and name
        """
        try:
            payload = json.loads(directive.payload.decode("utf-8"))
            print("Control payload: {}".format(payload), file=sys.stderr)
            control_type = payload["type"]
            if control_type == "deal-initial":
                # Expected params: [game, playerCount]
                self._dealCardOnGameStart(payload["game"], int(payload["playerCount"]))

            if control_type == "deal-turn":
                # Expected params: [game, playerCount, playerTurn]
                self._dealCardOnGameTurn(payload["game"], int(payload["playerCount"]), int(payload["playerTurn"]), payload["gameCommand"])

        except KeyError:
            print("Missing expected parameters: {}".format(directive), file=sys.stderr)

    def _dealCardOnGameStart(self, game, playerCount: int):
        """
        Handles dealing the cards based on game type and the number of players
        """
        print("Dealing cards: ({}, {})".format(game, playerCount), file=sys.stderr)
        if game in GameType.BLACKJACK.value:
            for i in range(playerCount):
                print("Dealing card to: ({})".format(i+1), file=sys.stderr)
                self._moveToPlayer(i+1, playerCount, False)
                self._dispenseCard()
            
            self._moveToBase(playerCount, playerCount)    

            for i in range(playerCount):
                print("Dealing card to: ({})".format(i+1), file=sys.stderr)
                self._moveToPlayer(i+1, playerCount, False)
                self._dispenseCard()
            
            self._moveToBase(playerCount, playerCount)

        if game in GameType.UNO.value:
            for k in range(4):
                for i in range(playerCount):
                    print("Dealing card to: ({})".format(i+1), file=sys.stderr)
                    self._moveToPlayer(i+1, playerCount, False)
                    self._dispenseCard()
            
                self._moveToBase(playerCount, playerCount)   

        if game in GameType.SHUFFLE_CARDS.value:
            for k in range(5):
                self._moveToPlayer(1, 2, True)
                cardsToDispense = random.randint(1, 3)
                for k in range(cardsToDispense):
                    self._dispenseCard()
                self._moveToBase(1, 2)

                self._moveToPlayer(2, 2, True)
                cardsToDispense = random.randint(1, 3)
                for k in range(cardsToDispense):
                    self._dispenseCard()
                self._moveToBase(2, 2)
                    

    def _dealCardOnGameTurn(self, game, playerCount: int, playerTurn: int, gameCommand):
        """
        Handles dealing the card based on game type and the turn in the game
        """
        print("Dealing cards: ({}, {}, {})".format(game, playerCount, playerTurn), file=sys.stderr)
        if game in GameType.BLACKJACK.value:
            if gameCommand in GameCommand.BLACKJACK_HIT.value:
                print("Dealing card to: ({})".format(playerTurn), file=sys.stderr)
                self._moveToPlayer(playerTurn, playerCount, True)
                self._dispenseCard()
                self._moveToBase(playerTurn, playerCount)

        if game in GameType.UNO.value:
            if gameCommand in GameCommand.UNO_DEAL_ONCE.value:
                print("Dealing card to: ({})".format(playerTurn), file=sys.stderr)
                cardsToDispense = random.randint(0, 3)
                if cardsToDispense > 0:
                    for k in range(cardsToDispense):
                        self._dispenseCard()
            if gameCommand in GameCommand.UNO_DEAL_TWICE.value:
                print("Dealing card to: ({})".format(playerTurn), file=sys.stderr)
                cardsToDispense = random.randint(0, 3)
                if cardsToDispense > 0:
                    for k in range(cardsToDispense):
                        self._dispenseCard()
                cardsToDispense = random.randint(0, 3)
                if cardsToDispense > 0:
                    for k in range(cardsToDispense):
                        self._dispenseCard()

    def _moveToPlayer(self, playerIndex: int, playerCount: int, oneTimeMove: bool):
        angle = -180 / playerCount
        turnAngle = angle
        print("Moving to player: ({}) out of ({})".format(playerIndex, playerCount), file=sys.stderr)
        if oneTimeMove == True:
            if playerIndex > 1:
                turnAngle = angle * (playerIndex - 1)
        if playerIndex == 1:
            turnAngle = 0
        print("Angle: ({})".format(turnAngle), file=sys.stderr)
        self.turnMotor.on_for_degrees(SpeedPercent(15), turnAngle, True)
        time.sleep(.25)

    def _moveToBase(self, playerIndex: int, playerCount: int):
        print("Reset to base", file=sys.stderr)
        time.sleep(.50)
        angle = 180 / playerCount
        turnAngle = angle
        if playerIndex > 1:
            turnAngle = angle * (playerIndex - 1)
        if playerIndex == 1:
            turnAngle = 0
        print("Angle: ({})".format(turnAngle), file=sys.stderr)
        self.turnMotor.on_for_degrees(SpeedPercent(15), turnAngle, True)

    def _dispenseCard(self):
        self.cardsMotor.on_for_rotations(SpeedPercent(-50), 0.5, True)
        time.sleep(.25)
        self.cardsMotor.on_for_rotations(SpeedPercent(-50), 0.2, True)
        time.sleep(.25)
        self.cardsMotor.on_for_rotations(SpeedPercent(50), 0.7, True)

if __name__ == '__main__':

    gadget = MindstormsGadget()

    # Set LCD font and turn off blinking LEDs
    os.system('setfont Lat7-Terminus12x6')
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")

    # Startup sequence
    gadget.sound.play_song((('C4', 'e'), ('D4', 'e'), ('E5', 'q')))
    gadget.leds.set_color("LEFT", "GREEN")
    gadget.leds.set_color("RIGHT", "GREEN")

    # Gadget main entry point
    gadget.main()

    # Shutdown sequence
    gadget.sound.play_song((('E5', 'e'), ('C4', 'e')))
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")
