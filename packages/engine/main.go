//go:build js && wasm

// Command engine builds the tree search into a WebAssembly module that JavaScript can call.
package main

import (
	"math/rand/v2"
	"syscall/js"

	"github.com/volodymyr-pavlov/go-game/packages/engine/game"
	"github.com/volodymyr-pavlov/go-game/packages/engine/wire"
)

const expectedArgs = 2

func main() {
	js.Global().Set("suggestMove", js.FuncOf(suggestMove))
	select {} // keep the module alive for further calls
}

func suggestMove(_ js.Value, args []js.Value) any {
	if len(args) != expectedArgs {
		return wire.ErrorJSON("suggestMove expects (positionJSON, playouts)")
	}
	position, err := wire.ParsePosition(args[0].String())
	if err != nil {
		return wire.ErrorJSON(err.Error())
	}
	if args[1].Type() != js.TypeNumber {
		return wire.ErrorJSON("playouts must be a number")
	}
	playouts := wire.ClampPlayouts(args[1].Int())
	result := game.Search(position, playouts, rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())))
	return wire.ToJSON(wire.ToResponse(result))
}
